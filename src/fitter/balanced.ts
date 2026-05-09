import type { SearchContext, SearchResult } from './types.js';
import { Score, FIT_TOLERANCE } from './types.js';
import { getArrangementMetrics } from '../measure/index.js';
import { generateSmartArrangements, trimLineWhitespace } from './wrapping.js';

/** Balanced strategy: evaluate arrangements near ideal break points, compute scale analytically */
export function findBalancedFit(ctx: SearchContext): SearchResult | undefined {
    let bestScale = 0;
    let bestArrangement: import('../types.js').Token[][] = [];
    let bestScore = new Score(0, [], ctx.wrap);
    let arrangements = 0;

    for (const arrangement of generateSmartArrangements(ctx.tokens, ctx.cumulativeWidths, ctx.totalTokenWidth, ctx.minLines, ctx.maxLines)) {
        const trimmed = arrangement.map(line => trimLineWhitespace(line));
        if (trimmed.some(line => line.length === 0)) continue;

        arrangements++;

        const lineTokenMetrics = trimmed.map(line =>
            line.map(token => ctx.tokenMetricsMap.get(token)!)
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
            const scalePercentage = scale / ctx.maxScale;
            const lineWidths = metrics.lineMetrics.map(lm => lm.width * scale);
            const score = new Score(scalePercentage, lineWidths, ctx.wrap);

            if (score.isBetterThan(bestScore)) {
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
        score: bestScore,
        arrangements,
    };
}
