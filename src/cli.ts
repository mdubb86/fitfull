#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { program, Option } from 'commander';
import { extname } from 'node:path';
import opentype from 'opentype.js';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { createRequire } from 'node:module';
import { fitfull, type FitOptions, type FitResult } from './fitfull.js';
import type { Token, FontWeight } from './types.js';
import { InputTokenArraySchema, inputTokensToTokens, parseFontString, mapWeight } from './schema.js';
import { normalizeFamily } from './fonts/normalize.js';

function status(msg: string) {
    console.error(`[fitfull] ${msg}`);
}

function parseSize(sizeStr: string): { width: number; height: number } {
    const match = sizeStr.match(/^(\d+)x(\d+)$/);
    if (!match) throw new Error(`Invalid size format: "${sizeStr}". Expected WxH (e.g., 400x800)`);
    const width = parseInt(match[1]);
    const height = parseInt(match[2]);
    if (width <= 0 || height <= 0) throw new Error(`Size dimensions must be positive integers (e.g. 400x100)`);
    return { width, height };
}

function svgToPng(svg: string): Uint8Array {
    const resvg = new Resvg(svg, { fitTo: { mode: 'original' as const } });
    return resvg.render().asPng();
}

function writeOutput(svg: string, outputPath: string) {
    const ext = extname(outputPath).toLowerCase();
    if (ext === '.svg') {
        writeFileSync(outputPath, svg);
    } else {
        writeFileSync(outputPath, svgToPng(svg));
    }
    status(`Written to ${outputPath}`);
}

function outputResult(result: FitResult, outputPath: string, elapsedMs: number) {
    console.log(JSON.stringify({
        width: Math.ceil(result.width),
        height: Math.ceil(result.height),
        minTextHeight: result.minTextHeight,
        maxTextHeight: result.maxTextHeight,
        lines: result.lines,
        output: outputPath,
        elapsed: Math.round(elapsedMs),
        arrangements: result.arrangements,
    }, null, 2));
}

/** Parse font argument - returns system font name or indicates it's a file path */
async function parseFontArg(fontArg: string): Promise<{ font: string; weight: FontWeight }> {
    if (existsSync(fontArg)) {
        const font = await opentype.load(fontArg);
        const family = font.names.fontFamily?.en || fontArg;
        const subfamily = (font.names.fontSubfamily?.en || 'Regular').toLowerCase();

        let weight: FontWeight = 'regular';
        const isBold = subfamily.includes('bold');
        const isItalic = subfamily.includes('italic') || subfamily.includes('oblique');

        if (isBold && isItalic) weight = 'bolditalic';
        else if (isBold) weight = 'bold';
        else if (isItalic) weight = 'italic';

        return { font: family, weight };
    } else {
        const parsed = parseFontString(fontArg);
        const weight = mapWeight(parsed.weight, parsed.style);
        return { font: parsed.family, weight };
    }
}

/** Build tokens from --tokens file (legacy token format support) */
async function loadTokensFromFile(tokensArg: string, fontArgs: string[]): Promise<Token[]> {
    const jsonContent = tokensArg === '-' ? readFileSync(0, 'utf-8') : readFileSync(tokensArg, 'utf-8');
    const inputTokens = InputTokenArraySchema.parse(JSON.parse(jsonContent));

    // Build font resolver from provided font files
    const familyMap = new Map<string, string>();
    for (const fontArg of fontArgs) {
        if (existsSync(fontArg)) {
            const { font } = await parseFontArg(fontArg);
            const familyKey = normalizeFamily(font);
            familyMap.set(font.toLowerCase(), familyKey);
        }
    }

    const resolver = (family: string): string => {
        const key = familyMap.get(family.toLowerCase());
        if (key) return key;
        return normalizeFamily(family);
    };

    return inputTokensToTokens(inputTokens, resolver);
}

// Main
program
    .name('fitfull')
    .description('Fit text into a given space and output SVG or PNG')
    .requiredOption('--size <WxH>', 'Target dimensions (e.g., 400x100)')
    .option('--text <string>', 'Text to render (simple mode)')
    .option('--tokens <file>', 'JSON token file, or - for stdin (token mode)')
    .option('--html <file>', 'HTML file, or - for stdin (HTML mode)')
    .option('--font <file>', 'Font file path or "Family Weight" (repeatable, applies to all modes)', (v, p: string[]) => p.concat([v]), [] as string[])
    .option('-o, --output <file>', 'Output file path', 'output.png')
    .option('--lines <number>', 'Use exact line count (omit to auto-compute)', (v) => parseInt(v, 10))
    .option('--min-lines <number>', 'Minimum number of lines (for auto mode)', (v) => parseInt(v, 10))
    .option('--max-lines <number>', 'Maximum number of lines (for auto mode)', (v) => parseInt(v, 10))
    .option('--text-height <number>', 'Fixed height for largest text in pixels (disables scale optimization)', parseFloat)
    .option('--max-text-height <number>', 'Maximum height for any text in pixels (constrains scale optimization)', parseFloat)
    .option('--line-spacing <number>', 'Line spacing multiplier', parseFloat, 1.0)
    .addOption(new Option('-a, --align <alignment>', 'Horizontal alignment (left, center, right)').choices(['left', 'center', 'right']).default('left'))
    .addOption(new Option('-w, --wrap <mode>', 'Line wrapping: balanced (even widths) or greedy (fill lines first)').choices(['balanced', 'greedy']).default('balanced'))
    .option('--max-tokens <n>', 'Maximum number of tokens (default: 1000)', (v) => parseInt(v, 10))
    .option('-c, --color <color>', 'Text color', '#000000')
    .option('-b, --background <color>', 'Background color (transparent if not set)')
    .option('--annotate', 'Show layout annotations (line bounds, token bounds, baselines)')
    .action(async (opts) => {
        try {
            // Validate conflicting options
            if (opts.textHeight !== undefined && opts.maxTextHeight !== undefined) {
                throw new Error('Cannot use both --text-height and --max-text-height');
            }
            if (opts.lines !== undefined) {
                if (opts.minLines !== undefined) {
                    throw new Error('Cannot use --min-lines with --lines');
                }
                if (opts.maxLines !== undefined) {
                    throw new Error('Cannot use --max-lines with --lines');
                }
            }

            const { width, height } = parseSize(opts.size);

            // Determine line constraints
            let minLines: number | undefined;
            let maxLines: number | undefined;

            if (opts.lines !== undefined) {
                minLines = opts.lines;
                maxLines = opts.lines;
            } else {
                minLines = opts.minLines;
                maxLines = opts.maxLines;
            }

            // Build fit options based on input mode
            let fitOptions: FitOptions;
            const inputCount = [opts.text, opts.tokens, opts.html].filter(Boolean).length;

            if (inputCount === 0) {
                throw new Error('Provide --text, --tokens, or --html');
            }
            if (inputCount > 1) {
                throw new Error('Provide only one of: --text, --tokens, or --html');
            }

            if (opts.tokens) {
                // Token mode - load tokens from file
                if (opts.font.length === 0) {
                    throw new Error('Token mode requires --font to specify font files');
                }
                const tokens = await loadTokensFromFile(opts.tokens, opts.font);
                fitOptions = {
                    tokens,
                    width,
                    height,
                    textHeight: opts.textHeight,
                    maxTextHeight: opts.maxTextHeight,
                    minLines,
                    maxLines,
                    lineSpacing: opts.lineSpacing,
                    align: opts.align,
                    wrap: opts.wrap,
                    fonts: opts.font,
                    _hint: 'cli' as const,
                    maxTokens: opts.maxTokens,
                };
            } else if (opts.html) {
                // HTML mode - HTML must have its own styling
                const htmlContent = opts.html === '-' ? readFileSync(0, 'utf-8') : readFileSync(opts.html, 'utf-8');
                fitOptions = {
                    html: htmlContent,
                    width,
                    height,
                    textHeight: opts.textHeight,
                    maxTextHeight: opts.maxTextHeight,
                    minLines,
                    maxLines,
                    lineSpacing: opts.lineSpacing,
                    align: opts.align,
                    wrap: opts.wrap,
                    fonts: opts.font,
                    _hint: 'cli' as const,
                    maxTokens: opts.maxTokens,
                };
            } else {
                // Text mode
                if (opts.font.length === 0) {
                    throw new Error('Text mode requires --font');
                }
                const { font, weight } = await parseFontArg(opts.font[0]);
                status(`Using font: ${font} ${weight}`);

                fitOptions = {
                    text: opts.text,
                    font,
                    fontWeight: weight,
                    width,
                    height,
                    textHeight: opts.textHeight,
                    maxTextHeight: opts.maxTextHeight,
                    minLines,
                    maxLines,
                    lineSpacing: opts.lineSpacing,
                    align: opts.align,
                    wrap: opts.wrap,
                    fonts: opts.font,
                    _hint: 'cli' as const,
                    maxTokens: opts.maxTokens,
                };
            }

            // Log fitting parameters
            if (opts.textHeight !== undefined) {
                status(`Fitting into ${width}x${height} at text-height=${opts.textHeight}px`);
            } else if (opts.maxTextHeight !== undefined) {
                status(`Fitting into ${width}x${height} (max text height: ${opts.maxTextHeight}px)`);
            } else {
                status(`Fitting into ${width}x${height}`);
            }

            // Use the singleton fitfull instance
            const ff = fitfull.get();

            const startTime = performance.now();
            const result = await ff.fit({
                ...fitOptions,
                color: opts.color,
                background: opts.background,
                annotate: opts.annotate,
            });
            const elapsed = performance.now() - startTime;

            if (result.lines.length === 0) {
                console.error('Error: No renderable text content');
                process.exit(1);
            }

            status(`Found fit: ${result.width.toFixed(0)}x${result.height.toFixed(0)}, ${result.lines.length} line(s)`);

            writeOutput(result.svg, opts.output);
            outputResult(result, opts.output, elapsed);
        } catch (err: any) {
            console.error('Error:', err.message);
            process.exit(1);
        }
    });

// Initialize resvg WASM before parsing commands
const _require = createRequire(import.meta.url);
const wasmPath = _require.resolve('@resvg/resvg-wasm/index_bg.wasm');
await initWasm(readFileSync(wasmPath));

program.parse();
