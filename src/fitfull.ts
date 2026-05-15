import type { Token, FontWeight, Alignment } from './types.js';
import type { FitterConfig } from './fitter/types.js';
import type { FontProvider } from './fonts/font-provider.js';
import type { ParseHtml } from './html-parser.js';
import { layoutToSVG } from './measure/index.js';
import Fitter from './fitter/index.js';
import { htmlToTokens } from './html-to-tokens.js';

/** Input variants for fitting */
export type FitfullInput =
    | { tokens: Token[] }
    | { text: string; font: string; fontWeight?: FontWeight }
    | { html: string };

/** Options shared by all environments (no font-source field). */
export type FitOptionsBase = FitfullInput & {
    // Dimensions - required
    width: number;
    height: number;

    // Fitting options
    textHeight?: number;
    maxTextHeight?: number;
    minLines?: number;
    maxLines?: number;
    lineSpacing?: number;
    align?: Alignment;
    wrap?: 'balanced' | 'greedy';
    /** Maximum number of tokens. Default: 1000. Pass Infinity to disable. */
    maxTokens?: number;
    /** Maximum fit duration in milliseconds. Default: 10000. Pass Infinity to disable. */
    timeout?: number;

    // SVG rendering options
    color?: string;
    background?: string;
    annotate?: boolean;
};

/** Result from fit() */
export interface FitResult {
    width: number;
    height: number;
    svg: string;
    arrangements: number;
    minTextHeight: number;
    maxTextHeight: number;
    lines: string[];
}

/**
 * Environment-agnostic fitting engine. Node and browser entries each subclass
 * this, supplying their own FontProvider and HTML parser.
 */
export class FitfullCore {
    constructor(
        protected readonly fontProvider: FontProvider,
        protected readonly parseHtml: ParseHtml,
    ) {}

    /**
     * Fit text/tokens/html into the given dimensions.
     * Automatically loads required fonts and renders to SVG.
     */
    async fit(options: FitOptionsBase & { fonts?: unknown; _hint?: 'cli' | 'api' }): Promise<FitResult> {
        const tokens = await this.resolveTokens(options);

        if (tokens.length === 0) {
            return {
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>',
                lines: [],
                width: 0,
                height: 0,
                minTextHeight: 0,
                maxTextHeight: 0,
                arrangements: 0,
            };
        }

        const maxTokens = options.maxTokens ?? 1000;
        if (isFinite(maxTokens) && tokens.length > maxTokens) {
            throw new Error(
                `Input too large: ${tokens.length} tokens (max ${maxTokens}). ` +
                `Reduce content or set maxTokens to increase the limit.`,
            );
        }

        // Load any fonts needed by these tokens
        await this.fontProvider.loadForTokens(tokens, {
            fonts: options.fonts,
            _hint: options._hint,
        });

        const timeout = options.timeout ?? 10_000;
        const deadline = isFinite(timeout) ? performance.now() + timeout : Infinity;

        // Build fitter config
        const config: FitterConfig = {
            textHeight: options.textHeight,
            maxTextHeight: options.maxTextHeight,
            minLines: options.minLines,
            maxLines: options.maxLines,
            lineSpacing: options.lineSpacing ?? 1.0,
            align: options.align ?? 'left',
            wrap: options.wrap ?? 'balanced',
            deadline,
        };

        // Run the fitter
        const fitter = new Fitter(tokens, this.fontProvider, options.width, options.height, config);
        const result = fitter.computeBestFit();

        // Render to SVG
        const svg = layoutToSVG(result.layout, {
            color: options.color,
            background: options.background,
            annotate: options.annotate,
        });

        return {
            width: result.layout.width,
            height: result.layout.height,
            svg,
            arrangements: result.arrangements,
            minTextHeight: result.minTextHeight,
            maxTextHeight: result.maxTextHeight,
            lines: result.layout.lines.map(line => line.text),
        };
    }

    /** Drop all loaded fonts. Preserved from the original public API. */
    clearFonts(): void {
        this.fontProvider.clear();
    }

    /**
     * Convert input options to tokens array.
     */
    private async resolveTokens(options: FitOptionsBase): Promise<Token[]> {
        if ('tokens' in options) {
            return options.tokens;
        }

        if ('text' in options) {
            const fontFamily = options.font;
            const weight = options.fontWeight ?? 'regular';
            return this.textToTokens(options.text, 12, fontFamily, weight);
        }

        if ('html' in options) {
            return htmlToTokens(options.html, this.parseHtml);
        }

        // TypeScript should make this unreachable
        throw new Error('Invalid input');
    }

    /**
     * Convert plain text to tokens (split on newlines then spaces).
     * Each \n becomes an explicit separator token (matching the HTML path convention).
     */
    private textToTokens(
        text: string,
        size: number,
        font: string,
        weight: FontWeight,
    ): Token[] {
        const tokens: Token[] = [];
        const lines = text.split('\n');

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const words = lines[lineIdx].split(' ').filter(w => w.length > 0);
            for (let i = 0; i < words.length; i++) {
                tokens.push({ text: words[i], size, font, weight });
                if (i < words.length - 1) {
                    tokens.push({ text: ' ', size, font, weight });
                }
            }
            if (lineIdx < lines.length - 1) {
                tokens.push({ text: '\n', size, font, weight });
            }
        }

        return tokens;
    }
}
