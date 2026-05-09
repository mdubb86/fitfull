import { performance } from 'node:perf_hooks';
import type { SearchContext, SearchResult } from './types.js';
import { FIT_TOLERANCE, SEARCH_PRECISION } from './types.js';
import { getArrangementMetrics } from '../measure/index.js';
import { buildGreedyArrangement } from './wrapping.js';

type GreedyScore = { scale: number; lastLineRatio: number };

function isBetterThan(a: GreedyScore, b: GreedyScore): boolean {
    if (a.scale > b.scale) return true;
    if (a.scale < b.scale) return false;
    return a.lastLineRatio < b.lastLineRatio;
}

/** Greedy strategy: binary search for optimal scale, greedy line filling at each scale */
export function findGreedyFit(ctx: SearchContext): SearchResult | undefined {
    const maxLines = Math.min(ctx.maxLines, ctx.tokens.length);
    const isFixedScale = ctx.minScale === ctx.maxScale;

    let bestScale = 0;
    let bestArrangement: import('../types.js').Token[][] = [];
    let bestScore: GreedyScore = { scale: 0, lastLineRatio: Infinity };
    let arrangements = 0;

    const tryScale = (scale: number): 'fit' | 'too_big' | 'too_small' => {
        if (performance.now() > ctx.deadline) {
            throw new Error(
                `Fit timed out with ${arrangements} arrangements evaluated. ` +
                `Reduce input size or increase timeout.`
            );
        }
        arrangements++;

        // Build greedy arrangement for this scale
        // targetWidth in scale=1 units = constraint / scale
        const targetWidthAtScale1 = ctx.width / scale;
        const arrangement = buildGreedyArrangement(
            ctx.tokens,
            ctx.tokenMetricsMap,
            maxLines,
            targetWidthAtScale1
        );

        if (arrangement.some(line => line.length === 0)) return 'too_big';

        // Check if it fits
        const lineTokenMetrics = arrangement.map(line =>
            line.map(token => ctx.tokenMetricsMap.get(token)!)
        );

        const metrics = getArrangementMetrics(
            lineTokenMetrics,
            ctx.lineSpacing
        );

        const scaledWidth = metrics.maxWidth * scale;
        const scaledHeight = metrics.totalHeight * scale;
        const fitsWidth = scaledWidth <= ctx.width + FIT_TOLERANCE;
        const fitsHeight = scaledHeight <= ctx.height + FIT_TOLERANCE;
        const tooFewLines = arrangement.length < ctx.minLines;
        const tooManyLines = arrangement.length > maxLines;

        // Check maxTextHeight constraint
        let fitsTextHeight = true;
        if (ctx.maxTextHeight) {
            const tallestLineHeight = Math.max(...metrics.lineMetrics.map(lm => lm.height)) * scale;
            fitsTextHeight = tallestLineHeight <= ctx.maxTextHeight;
        }

        if (fitsWidth && fitsHeight && fitsTextHeight && !tooFewLines && !tooManyLines) {
            const lineWidths = metrics.lineMetrics.map(lm => lm.width * scale);
            const avg = lineWidths.reduce((a, b) => a + b, 0) / lineWidths.length;
            const lastRatio = avg > 0 ? (lineWidths[lineWidths.length - 1] ?? 0) / avg : 0;
            const candidate: GreedyScore = { scale: scale / ctx.maxScale, lastLineRatio: lastRatio };
            if (isBetterThan(candidate, bestScore)) {
                bestScale = scale;
                bestArrangement = arrangement;
                bestScore = candidate;
            }
            return 'fit';
        }

        // Too few lines = text fits too easily, need bigger scale
        if (tooFewLines) return 'too_small';
        // Too wide, too tall, or too many lines = need smaller scale
        return 'too_big';
    };

    if (isFixedScale) {
        // Fixed scale: just try the one scale
        tryScale(ctx.minScale);
    } else {
        // Binary search for optimal scale
        let lo = ctx.minScale;
        let hi = ctx.maxScale;
        while (hi - lo > SEARCH_PRECISION) {
            const mid = (lo + hi) / 2;
            const result = tryScale(mid);
            if (result === 'fit') {
                lo = mid;
            } else if (result === 'too_small') {
                lo = mid;
            } else {
                hi = mid;
            }
        }

        // Greedy wrapping is non-monotonic: higher scale can wrap differently and fit.
        // Probe above the binary search result to catch these cases.
        const binarySearchBest = bestScale;
        const probeCount = 10;
        const probeStep = (ctx.maxScale - binarySearchBest) / probeCount;
        // Linear probe above binary search result: greedy wrapping is non-monotone near
        // wrap-count boundaries, so binary search alone can miss the true optimum.
        if (probeStep === 0) return bestArrangement.length === 0 ? undefined : {
            scale: bestScale,
            arrangement: bestArrangement,
            arrangements,
        };
        for (let i = 1; i <= probeCount; i++) {
            const probeScale = binarySearchBest + i * probeStep;
            if (probeScale <= ctx.maxScale) {
                tryScale(probeScale);
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
