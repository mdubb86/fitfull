import type { Token, FontWeight, Alignment } from './types.js';
import type { FitterConfig } from './fitter/types.js';
import { FontManager } from './fonts/index.js';
import { layoutToSVG } from './measure/index.js';
import Fitter from './fitter/index.js';
import { htmlToTokens } from './html-to-tokens.js';

/** Input variants for fitting */
export type FitfullInput =
    | { tokens: Token[] }
    | { text: string; font: string; fontWeight?: FontWeight }
    | { html: string };

/** Options for fitting text */
export type FitOptions = FitfullInput & {
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
 * High-level API for text fitting.
 * Manages fonts internally and provides simple fit() and fitToSVG() methods.
 */
export class Fitfull {
    private fonts: FontManager | null = null;
    private static instance: Fitfull | null = null;

    constructor() {}

    /**
     * Get the singleton instance.
     * Font cache persists across all fit() calls.
     */
    static get(): Fitfull {
        if (!Fitfull.instance) {
            Fitfull.instance = new Fitfull();
        }
        return Fitfull.instance;
    }

    /**
     * Create a new instance with its own font cache.
     * Use when you need isolated font management or want to allow GC.
     */
    static create(): Fitfull {
        return new Fitfull();
    }

    /**
     * Fit text/tokens/html into the given dimensions.
     * Automatically loads required fonts and renders to SVG.
     */
    async fit(options: FitOptions): Promise<FitResult> {
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

        // Ensure FontManager exists
        if (!this.fonts) {
            this.fonts = await FontManager.create();
        }

        // Load any fonts needed by these tokens
        await this.fonts.loadForTokens(tokens);

        // Build fitter config
        const config: FitterConfig = {
            textHeight: options.textHeight,
            maxTextHeight: options.maxTextHeight,
            minLines: options.minLines,
            maxLines: options.maxLines,
            lineSpacing: options.lineSpacing ?? 1.0,
            align: options.align ?? 'left',
            wrap: options.wrap ?? 'balanced',
        };

        // Run the fitter
        const fitter = new Fitter(tokens, this.fonts, options.width, options.height, config);
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

    /**
     * Clear the font cache, allowing fonts to be garbage collected.
     */
    clearFonts(): void {
        this.fonts = null;
    }

    /**
     * Convert input options to tokens array.
     */
    private async resolveTokens(options: FitOptions): Promise<Token[]> {
        if ('tokens' in options) {
            return options.tokens;
        }

        if ('text' in options) {
            const fontFamily = options.font;
            const weight = options.fontWeight ?? 'regular';
            return this.textToTokens(options.text, 12, fontFamily, weight);
        }

        if ('html' in options) {
            return htmlToTokens(options.html);
        }

        // TypeScript should make this unreachable
        throw new Error('Invalid input');
    }

    /**
     * Convert plain text to tokens (split on spaces).
     */
    private textToTokens(
        text: string,
        size: number,
        font: string,
        weight: 'regular' | 'bold' | 'italic' | 'bolditalic'
    ): Token[] {
        const tokens: Token[] = [];
        const words = text.split(' ').filter(w => w.length > 0);

        for (let i = 0; i < words.length; i++) {
            tokens.push({ text: words[i], size, font, weight });
            if (i < words.length - 1) {
                tokens.push({ text: ' ', size, font, weight });
            }
        }

        return tokens;
    }
}

/**
 * Namespace providing access to singleton and factory.
 */
export const fitfull = {
    /**
     * Get the singleton instance.
     * Font cache persists across all fit() calls.
     */
    get: (): Fitfull => Fitfull.get(),

    /**
     * Create a new instance with its own font cache.
     */
    create: (): Fitfull => Fitfull.create(),
};
