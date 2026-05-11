import { performance } from 'node:perf_hooks';
import type { SearchContext, SearchResult } from './types.js';
import { FIT_TOLERANCE } from './types.js';
import { getArrangementMetrics } from '../measure/index.js';
import { generateSmartArrangements, trimLineWhitespace, getOrComputeTokenMetrics, lineWidthVariance } from './wrapping.js';

/** Variance penalty weight: score = scale - K * normalizedVariance */
const VARIANCE_PENALTY_K = 0.05;

type BalancedScore = { scale: number; combinedScore: number; minLineWidth: number };

function isBetterThan(a: BalancedScore, b: BalancedScore): boolean {
    if (a.combinedScore > b.combinedScore) return true;
    if (a.combinedScore < b.combinedScore) return false;
    return a.minLineWidth > b.minLineWidth;
}

/** Balanced strategy: evaluate arrangements near ideal break points, compute scale analytically */
export function findBalancedFit(ctx: SearchContext): SearchResult | undefined {
    let bestScale = 0;
    let bestArrangement: import('../types.js').Token[][] = [];
    let bestScore: BalancedScore = { scale: 0, combinedScore: -Infinity, minLineWidth: 0 };
    let arrangements = 0;

    for (const arrangement of generateSmartArrangements(ctx.tokens, ctx.cumulativeWidths, ctx.totalTokenWidth, ctx.minLines, ctx.maxLines)) {
        if (performance.now() > ctx.deadline) {
            throw new Error(
                `Fit timed out with ${arrangements} arrangements evaluated. ` +
                `Reduce input size or increase timeout.`
            );
        }
        const trimmed = arrangement.map(line => trimLineWhitespace(line));
        if (trimmed.some(line => line.length === 0)) continue;

        arrangements++;

        const lineTokenMetrics = trimmed.map(line =>
            line.map(token => getOrComputeTokenMetrics(token, ctx.tokenMetricsMap, ctx.fonts))
        );

        const metrics = getArrangementMetrics(
            lineTokenMetrics,
            ctx.lineSpacing
        );

        // Calculate optimal scale analytically
        let scale = Math.min(
            ctx.width / metrics.maxWidth,
            ctx.height / metrics.totalHeight
        );

        // Clamp to min/max
        scale = Math.max(ctx.minScale, Math.min(ctx.maxScale, scale));

        // Apply maxTextHeight constraint if set
        if (ctx.maxTextHeight) {
            const tallestLineHeight = Math.max(...metrics.lineMetrics.map(lm => lm.height));
            const maxScaleForHeight = ctx.maxTextHeight / tallestLineHeight;
            scale = Math.min(scale, maxScaleForHeight);
        }

        const scaledWidth = metrics.maxWidth * scale;
        const scaledHeight = metrics.totalHeight * scale;
        if (scaledWidth <= ctx.width + FIT_TOLERANCE && scaledHeight <= ctx.height + FIT_TOLERANCE) {
            const lineWidths = metrics.lineMetrics.map(lm => lm.width * scale);
            const normalizedScale = scale / ctx.maxScale;
            const normalizedVariance = lineWidthVariance(lineWidths, ctx.width);
            const score: BalancedScore = {
                scale: normalizedScale,
                combinedScore: normalizedScale - VARIANCE_PENALTY_K * normalizedVariance,
                minLineWidth: Math.min(...lineWidths),
            };
            if (isBetterThan(score, bestScore)) {
                bestScale = scale;
                bestArrangement = trimmed;
                bestScore = score;
            }
        }
    }

    if (bestArrangement.length === 0) return undefined;

    return {
        scale: bestScale,
        arrangement: bestArrangement,
        arrangements,
    };
}
