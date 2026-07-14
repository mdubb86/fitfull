import type { TokenMetrics, Shadow } from '../types.js';

/**
 * Distance (in σ units) at which a gaussian shadow with the given color's
 * alpha channel fades below the perceptibility threshold — the point where
 * a casual viewer stops noticing the shadow tail.
 *
 *   alpha * exp(-N² / 2) < threshold
 *   N > sqrt(-2 * ln(threshold / alpha))
 *
 * Threshold is 10% opacity: below that the shadow tail reads as background
 * to a human eye. (A stricter 1% threshold matches "measurement invisible"
 * but reserves ~40% more space than the eye can actually see fading — text
 * shrinks visibly farther than the shadow visibly reaches.)
 *
 * Opaque (alpha=1) → N≈2.15. Semi-transparent (alpha=0.5) → N≈1.79.
 * Very faint (alpha=0.1) → N=0 (peak already below threshold — no
 * reservation needed).
 *
 * Extracts alpha from `rgba(r,g,b,a)` and `#RRGGBBAA`; defaults to 1 for
 * hex, rgb, and named colors. This threshold is used to align fit-time
 * reservation and render-time viewBox extension so text shrinks exactly
 * as much as needed for the visible shadow — no more, no less.
 */
export const PERCEPTIBILITY_THRESHOLD = 0.50;

export function shadowVisibleSigma(color: string | undefined): number {
    const alpha = parseColorAlpha(color);
    if (alpha <= 0) return 0;
    const ratio = PERCEPTIBILITY_THRESHOLD / alpha;
    if (ratio >= 1) return 0;
    return Math.sqrt(-2 * Math.log(ratio));
}

function parseColorAlpha(color: string | undefined): number {
    if (!color) return 1;
    const rgba = color.match(/rgba?\s*\([^)]*?,\s*([\d.]+)\s*\)/i);
    if (rgba) {
        const a = parseFloat(rgba[1]);
        return isFinite(a) ? Math.max(0, Math.min(1, a)) : 1;
    }
    const hex8 = color.match(/^#([0-9a-fA-F]{8})$/);
    if (hex8) return parseInt(hex8[1].slice(6, 8), 16) / 255;
    return 1;
}

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
 *   blur > 0     → symmetric N*σ inflation on all four sides, where N is
 *                  the visible-sigma derived from the shadow's alpha (see
 *                  shadowVisibleSigma). Aligns with render-time viewBox
 *                  extension so text shrinks exactly enough for the
 *                  visible shadow envelope.
 */
export function inflateForShadow(
    metrics: TokenMetrics,
    shadow: Shadow | undefined,
    tokenSize: number,
): TokenMetrics {
    if (!shadow) return metrics;
    const sx = shadow.offsetX * tokenSize;
    const sy = shadow.offsetY * tokenSize;
    const blurPx = (shadow.blur ?? 0) * tokenSize;
    const tail = shadowVisibleSigma(shadow.color) * blurPx;

    // Peak-centered envelope. Shadow gaussian is centered at (glyph_edge + offset),
    // extends ±tail from its peak. On each side:
    //   right = max(0, tail + sx)  (offset-side: offset + full tail)
    //   left  = max(0, tail - sx)  (opposite: only tail-past-glyph, if any)
    // Equivalent (and symmetric) for y.
    const leftExtra   = Math.max(0, tail - sx);
    const rightExtra  = Math.max(0, tail + sx);
    const topExtra    = Math.max(0, tail - sy);
    const bottomExtra = Math.max(0, tail + sy);

    return {
        ...metrics,
        advanceWidth: metrics.advanceWidth + leftExtra + rightExtra,
        leftBearing:  metrics.leftBearing - leftExtra,
        tightRight:   metrics.tightRight  + rightExtra,
        tightTop:     metrics.tightTop    - topExtra,
        tightBottom:  metrics.tightBottom + bottomExtra,
    };
}
