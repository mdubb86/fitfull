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
 *   blur > 0     → NOT counted at fit time
 *
 * Blur is treated as a soft presentation effect and does not reserve
 * space in the fit. Rationale: blur reservation is em-relative to
 * token.size (the geometry of the em unit means even 1σ reservation
 * causes ~15% text shrink at blur=0.15 for typical glyph aspect
 * ratios). Users perceive this as "text shrank more than the shadow
 * grew". Matches CSS text-shadow semantics — the shadow doesn't
 * displace layout. Blur bleeds past the fit box via the SVG's
 * overflow="visible" plus a render-time viewBox extension that
 * captures ~1σ of the tail so exports still show the envelope.
 * Consumers relying on tight glyph-only clipping to the fit box
 * should either avoid blur or clip explicitly.
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

    const sxPos = Math.max(0, sx);
    const sxNeg = Math.max(0, -sx);
    const syPos = Math.max(0, sy);
    const syNeg = Math.max(0, -sy);

    return {
        ...metrics,
        advanceWidth: metrics.advanceWidth + sxNeg + sxPos,
        leftBearing:  metrics.leftBearing - sxNeg,
        tightRight:   metrics.tightRight  + sxPos,
        tightTop:     metrics.tightTop    - syNeg,
        tightBottom:  metrics.tightBottom + syPos,
    };
}
