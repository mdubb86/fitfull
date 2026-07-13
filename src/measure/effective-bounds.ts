import type { TokenMetrics, Shadow } from '../types.js';

/**
 * Return a `TokenMetrics` inflated for the given shadow. The fitter sees the
 * inflated metrics and picks a smaller scale so the shadow does not bleed
 * past the box. Offset/blur are em-relative to `tokenSize`.
 *
 * Sign convention:
 *   offsetX > 0  → shadow extends right (grows advanceWidth + tightRight)
 *   offsetX < 0  → shadow extends left  (grows advanceWidth + shifts leftBearing left)
 *   offsetY > 0  → shadow extends down  (grows tightBottom — screen coords)
 *   offsetY < 0  → shadow extends up    (grows tightTop, i.e. shifts more negative)
 *   blur > 0     → symmetric ~3σ inflation on all four sides
 *
 * Note on arithmetic order: the additions below are written to be
 * IEEE-754 bit-exact with the values the test suite computes independently
 * (e.g. `tightRight` accumulates the offset then the blur term as two
 * separate `+`, rather than via a single pre-summed `rightExtra`, because
 * `(a + b) + c` is not always bit-identical to `a + (b + c)`). All forms
 * are mathematically equivalent; only the rounding of the last bit differs.
 */
export function inflateForShadow(
    metrics: TokenMetrics,
    shadow: Shadow | undefined,
    tokenSize: number,
): TokenMetrics {
    if (!shadow) return metrics;
    const sx = shadow.offsetX * tokenSize;
    const sy = shadow.offsetY * tokenSize;
    const blur = (shadow.blur ?? 0) * tokenSize;
    const blurExtra = 3 * blur;

    const sxPos = Math.max(0, sx);
    const sxNeg = Math.max(0, -sx);
    const syPos = Math.max(0, sy);
    const syNeg = Math.max(0, -sy);

    const leftExtra  = sxNeg + blurExtra;
    const rightExtra = sxPos + blurExtra;

    return {
        ...metrics,
        advanceWidth: metrics.advanceWidth + (leftExtra + rightExtra),
        leftBearing:  metrics.leftBearing - sxNeg - blurExtra,
        tightRight:   metrics.tightRight  + sxPos + blurExtra,
        tightTop:     metrics.tightTop    - syNeg - blurExtra,
        tightBottom:  metrics.tightBottom + syPos + blurExtra,
    };
}
