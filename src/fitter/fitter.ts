import type { Token, TokenMetrics, Alignment, Shadow } from '../types.js';
import { measureLine, measureAllTokenMetrics, getAdvanceWidth, computeLayout, inflateForShadow } from '../measure/index.js';
import { getFontMetrics } from '../fonts/index.js';
import type { FontProvider } from '../fonts/index.js';
import type { FitterConfig, BestFit, SearchContext } from './types.js';
import { FIT_TOLERANCE } from './types.js';
import { findGreedyFit } from './greedy.js';
import { findBalancedFit } from './balanced.js';

/** Fitter class - finds optimal arrangement for tokens within constraints */
export default class Fitter {
    private readonly tokens: Token[];
    private readonly fonts: FontProvider;
    private readonly width: number;
    private readonly height: number;
    private readonly textHeight?: number;
    private readonly maxTextHeight?: number;
    private readonly lineSpacing: number;
    private readonly minLines: number;
    private readonly maxLines: number;
    private readonly align: Alignment;
    private readonly wrap: 'balanced' | 'greedy';
    private readonly deadline: number;
    private readonly shadow?: Shadow;

    constructor(
        tokens: Token[],
        fonts: FontProvider,
        width: number,
        height: number,
        config: FitterConfig
    ) {
        this.tokens = tokens;
        this.fonts = fonts;
        this.width = width;
        this.height = height;

        if (config.textHeight && config.maxTextHeight) {
            throw new Error('Cannot use both textHeight and maxTextHeight');
        }

        this.textHeight = config.textHeight;
        this.maxTextHeight = config.maxTextHeight;
        this.lineSpacing = config.lineSpacing ?? 1.0;
        this.align = config.align;
        this.wrap = config.wrap ?? 'balanced';
        this.deadline = config.deadline ?? Infinity;
        this.shadow = config.shadow;

        // Estimate optimal line count from text ribbon / box aspect ratio.
        const largestTokenSize = Math.max(...tokens.map(t => t.size));
        const largestToken = tokens.find(t => t.size === largestTokenSize)!;
        const largestFont = fonts.getFont(largestToken.font, largestToken.weight);

        // Total text width at scale=1 (the "ribbon"):
        let totalAdvanceWidth = 0;
        for (const token of tokens) {
            const font = fonts.getFont(token.font, token.weight);
            totalAdvanceWidth += getAdvanceWidth(font, token.text, token.size);
        }
        // Representative line height at scale=1 (use largest token's font metrics):
        const lineHeight = getFontMetrics(largestFont, largestTokenSize).lineHeight * this.lineSpacing;

        // Optimal N where width and height constraints balance:
        // N* = sqrt(totalWidth * boxHeight / (boxWidth * lineHeight))
        const estimatedLines = Math.sqrt(totalAdvanceWidth * height / (width * lineHeight));
        const defaultMaxLines = Math.max(1, Math.ceil(estimatedLines * 2));

        this.minLines = config.minLines ?? 1;
        this.maxLines = Math.min(config.maxLines ?? defaultMaxLines, tokens.length);
    }

    /** Find the best fit for tokens within constraints */
    computeBestFit(): BestFit {
        // 1. Measure all tokens, precompute kerning, and build cumulative widths
        const allMetrics = measureAllTokenMetrics(this.tokens, this.fonts);

        // Raw (pre-inflation) tight heights — used as the reference for
        // textHeight and the returned minTextHeight/maxTextHeight so those
        // sizes refer to the visible glyph body, NOT the shadow envelope.
        // Shadow extends beyond the requested textHeight.
        let rawMaxTightHeight = 0;
        let rawMinTightHeight = Infinity;
        for (let i = 0; i < this.tokens.length; i++) {
            const m = allMetrics[i];
            const th = m.tightBottom - m.tightTop;
            if (th > rawMaxTightHeight) rawMaxTightHeight = th;
            if (th > 0 && th < rawMinTightHeight) rawMinTightHeight = th;
        }
        if (rawMinTightHeight === Infinity) rawMinTightHeight = rawMaxTightHeight;

        // Inflate per-token metrics for any effective shadow. Per-token
        // `token.shadow` beats the top-level default.
        for (let i = 0; i < this.tokens.length; i++) {
            const tok = this.tokens[i];
            const eff = tok.shadow ?? this.shadow;
            if (eff) {
                allMetrics[i] = inflateForShadow(allMetrics[i], eff, tok.size);
            }
        }

        const tokenMetricsMap = new Map<Token, TokenMetrics>();
        const cumulativeWidths: number[] = new Array(this.tokens.length);
        let widthSum = 0;
        for (let i = 0; i < this.tokens.length; i++) {
            tokenMetricsMap.set(this.tokens[i], allMetrics[i]);
            widthSum += allMetrics[i].advanceWidth;
            cumulativeWidths[i] = widthSum;
        }
        const totalTokenWidth = widthSum;

        // 2. Compute scale bounds using tight heights from measured tokens
        const largestTokenSize = Math.max(...this.tokens.map(t => t.size));
        const smallestTokenSize = Math.min(...this.tokens.filter(t => t.text.trim()).map(t => t.size));

        // Find tallest and shortest token's tight height at scale=1 (inflated —
        // used for the auto-scale search which must respect the shadow envelope
        // inside the box).
        let maxTightHeight = 0;
        let minTightHeight = Infinity;
        for (let i = 0; i < this.tokens.length; i++) {
            const m = allMetrics[i];
            const tightHeight = m.tightBottom - m.tightTop;
            if (tightHeight > maxTightHeight) {
                maxTightHeight = tightHeight;
            }
            // Skip whitespace for min height
            if (tightHeight > 0 && tightHeight < minTightHeight) {
                minTightHeight = tightHeight;
            }
        }
        // If all tokens were whitespace, use maxTightHeight
        if (minTightHeight === Infinity) {
            minTightHeight = maxTightHeight;
        }

        let minScale: number;
        let maxScale: number;

        if (this.textHeight) {
            // Fixed text height: set scale so the tallest RAW glyph reaches the
            // requested height. Shadow extends beyond — the output PNG/SVG
            // dimensions grow to accommodate it. This lets callers use
            // textHeight as a stable "font size" that doesn't shift when the
            // shadow gets larger.
            const fixedScale = this.textHeight / rawMaxTightHeight;
            minScale = fixedScale;
            maxScale = fixedScale;
        } else {
            // Auto scale mode
            // minScale: smallest token should be at least 1px
            minScale = 1 / smallestTokenSize;

            // maxScale: largest token should be at most 1.5x constraint height
            // (maxTextHeight is handled per-arrangement in strategy functions)
            maxScale = (1.5 * this.height) / largestTokenSize;
        }

        // 3. Build search context and dispatch to strategy
        const ctx: SearchContext = {
            tokens: this.tokens,
            fonts: this.fonts,
            tokenMetricsMap,
            width: this.width,
            height: this.height,
            minScale,
            maxScale,
            minLines: this.minLines,
            maxLines: this.maxLines,
            lineSpacing: this.lineSpacing,
            wrap: this.wrap,
            cumulativeWidths,
            totalTokenWidth,
            maxTextHeight: this.maxTextHeight,
            deadline: this.deadline,
            shadow: this.shadow,
        };

        const result = this.wrap === 'greedy'
            ? findGreedyFit(ctx)
            : findBalancedFit(ctx);

        if (!result) {
            const text = this.tokens.map(t => t.text).join('').slice(0, 80);
            throw new Error(
                `Unable to fit ${this.tokens.length} tokens into ${this.width}x${this.height} ` +
                `(scale ${minScale.toFixed(3)}–${maxScale.toFixed(3)}, ` +
                `lines ${this.minLines}–${this.maxLines}, ${this.wrap}): "${text}"`
            );
        }

        // 5. Generate actual paths only for the winning arrangement
        const scaledTokens = result.arrangement.map(line =>
            line.map(token => ({ ...token, size: token.size * result.scale }))
        );
        const measuredLines = scaledTokens.map(line => measureLine(line, this.fonts));

        // 6. Compute positioned layout
        const layout = computeLayout(measuredLines, this.lineSpacing, this.align, result.scale);

        // 7. Validate final dimensions fit within constraints
        const widthExceeds = layout.width > this.width + FIT_TOLERANCE;
        const heightExceeds = layout.height > this.height + FIT_TOLERANCE;

        if (widthExceeds || heightExceeds) {
            const msg = widthExceeds && heightExceeds
                ? `Output ${layout.width.toFixed(0)}x${layout.height.toFixed(0)} exceeds constraint ${this.width}x${this.height}`
                : widthExceeds
                    ? `Output width ${layout.width.toFixed(0)} exceeds constraint ${this.width}`
                    : `Output height ${layout.height.toFixed(0)} exceeds constraint ${this.height}`;

            throw new Error(`${msg} at scale=${result.scale.toFixed(3)}`);
        }

        return {
            layout,
            arrangements: result.arrangements,
            // Report raw glyph heights so consumers see the actual visible
            // text size, not the shadow-inflated envelope.
            minTextHeight: rawMinTightHeight * result.scale,
            maxTextHeight: rawMaxTightHeight * result.scale,
        };
    }
}
