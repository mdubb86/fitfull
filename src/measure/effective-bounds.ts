import type { TokenMetrics, Shadow } from '../types.js';

/**
 * Distance (in σ units) at which a gaussian-blurred filled-shape shadow with
 * the given color's alpha fades below the perceptibility threshold — the
 * distance past the glyph edge where the shadow becomes visually invisible.
 *
 * Physics reminder: `feGaussianBlur` convolves the source alpha with a
 * gaussian, so the fade past a flat edge follows the complementary error
 * function, not a raw gaussian:
 *
 *   edge_alpha(d) = alpha * 0.5 * erfc(d / (σ * sqrt(2)))
 *
 * Setting `edge_alpha(N * σ) < threshold` and solving:
 *
 *   N > sqrt(2) * erfcInv(2 * threshold / alpha)
 *
 * We use a 1% opacity threshold — below that the tail is imperceptible on
 * any composite background. Opaque (alpha=1) → N ≈ 2.33. Semi-transparent
 * (alpha=0.5) → N ≈ 2.05. Very faint (alpha ≤ 2%) → N = 0 (peak already
 * below threshold — no reservation needed).
 *
 * Extracts alpha from `rgba(r,g,b,a)` and `#RRGGBBAA`; defaults to 1 for
 * hex, rgb, and named colors. This distance is used to align fit-time
 * reservation and render-time viewBox extension so the reserved space
 * matches the visible envelope.
 */
export const DEFAULT_SHADOW_FADE_THRESHOLD = 0.10;

export function shadowVisibleSigma(color: string | undefined, threshold: number = DEFAULT_SHADOW_FADE_THRESHOLD): number {
    const alpha = parseColorAlpha(color);
    if (alpha <= 0) return 0;
    const arg = (2 * threshold) / alpha;
    if (arg >= 1) return 0;
    return Math.SQRT2 * erfcInv(arg);
}

/** Inverse of the complementary error function via Newton–Raphson on erfc.
 *  Domain: 0 < y < 2. Uses Winitzki's approximation as the initial guess
 *  and refines with Newton to ~1e-9 accuracy. */
function erfcInv(y: number): number {
    // Winitzki initial guess: solve for x from erf(x) = 1 - y via approximation.
    const p = 1 - y; // ≡ erf(x)
    const a = 0.147; // Winitzki constant
    const ln1mp2 = Math.log(Math.max(1e-300, 1 - p * p));
    const term = 2 / (Math.PI * a) + ln1mp2 / 2;
    let x = Math.sign(p) * Math.sqrt(Math.sqrt(term * term - ln1mp2 / a) - term);
    // Newton refinement — 6 iterations is plenty; erfc/derr converge fast.
    for (let i = 0; i < 6; i++) {
        const err = erfc(x) - y;
        // d/dx erfc(x) = -2/√π * exp(-x²)
        const derr = -2 / Math.sqrt(Math.PI) * Math.exp(-x * x);
        if (derr === 0) break;
        const step = err / derr;
        x -= step;
        if (Math.abs(step) < 1e-12) break;
    }
    return x;
}

/** Complementary error function via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7). */
function erfc(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const erfAbs = 1 - poly * Math.exp(-ax * ax);
    return 1 - sign * erfAbs;
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
    const tail = shadowVisibleSigma(shadow.color, shadow.fadeThreshold) * blurPx;

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
