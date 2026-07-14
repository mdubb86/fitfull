import type { MeasuredLine, PositionedLayout } from '../types.js';
import type { Shadow } from '../types.js';
import { shadowVisibleSigma } from './effective-bounds.js';

const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/;

function assertValidColor(value: string, field: string): void {
    if (!CSS_COLOR_RE.test(value.trim())) {
        throw new Error(
            `Invalid ${field} color: "${value}". Use a CSS color (hex, rgb(), rgba(), hsl(), hsla(), or a named color).`
        );
    }
}

const DEFAULT_SHADOW_COLOR = 'rgba(0,0,0,0.5)';

/**
 * Compute output-space shadow deltas for a token given its rendered size.
 * offsetX/Y/blur are em-relative; multiplying by the (post-scale) token
 * size converts to output pixels.
 */
function shadowDeltas(shadow: Shadow, tokenSize: number): {
    dx: number; dy: number; blurPx: number; color: string;
} {
    return {
        dx: shadow.offsetX * tokenSize,
        dy: shadow.offsetY * tokenSize,
        blurPx: (shadow.blur ?? 0) * tokenSize,
        color: shadow.color ?? DEFAULT_SHADOW_COLOR,
    };
}

/**
 * Return a canonical string key for a blur radius so filter defs dedup
 * cleanly. Keys quantize to 0.01 px — well below perceptible difference.
 */
function blurKey(blurPx: number): string {
    return blurPx.toFixed(2);
}

function filterId(key: string): string {
    // ID-safe: strip the dot from the key.
    return `fitfull-shadow-blur-${key.replace('.', '_')}`;
}

function assertValidShadow(shadow: Shadow, where: string): void {
    if (shadow.color !== undefined) assertValidColor(shadow.color, `${where} shadow color`);
}

/**
 * Compute per-side output-space shadow inflation across a set of tokens so
 * the SVG viewBox can be expanded to include the shadow. Without this the
 * viewBox is tight to the raw glyph bbox and viewers clip the shadow.
 *
 * The per-shadow σ multiplier is derived from the shadow's alpha channel via
 * `shadowVisibleSigma`, so an opaque glow gets ~3σ padding (visible far into
 * the tail) while a semi-transparent shadow gets ~2σ (fades faster). The
 * same helper is used at fit time in `inflateForShadow`, so the reserved
 * space equals the visible envelope — no dead padding, no clip artifact.
 */
function shadowInflation(
    lines: readonly MeasuredLine[],
    topLevelShadow: Shadow | undefined,
): { left: number; right: number; top: number; bottom: number } {
    let left = 0, right = 0, top = 0, bottom = 0;
    for (const line of lines) {
        for (const mt of line.tokens) {
            const eff = mt.token.shadow ?? topLevelShadow;
            if (!eff) continue;
            const { dx, dy, blurPx } = shadowDeltas(eff, mt.token.size);
            const tail = shadowVisibleSigma(eff.color) * blurPx;
            // Peak-centered gaussian envelope: visible edge = offset ± tail.
            left   = Math.max(left,   Math.max(0, tail - dx));
            right  = Math.max(right,  Math.max(0, tail + dx));
            top    = Math.max(top,    Math.max(0, tail - dy));
            bottom = Math.max(bottom, Math.max(0, tail + dy));
        }
    }
    return { left, right, top, bottom };
}

/**
 * Render a measured line to an SVG string
 */
export function lineToSVG(line: MeasuredLine, options: {
    padding?: number;
    background?: string;
    color?: string;
    /** Top-level shadow default; per-token `token.shadow` overrides. */
    shadow?: Shadow;
    showBaseline?: boolean;
    showBorder?: boolean;
    useTightBounds?: boolean;
} = {}): string {
    const {
        padding = 0,
        background,
        color = 'black',
        showBaseline = false,
        showBorder = false,
        useTightBounds = true,
    } = options;

    if (color) assertValidColor(color, 'color');
    if (background) assertValidColor(background, 'background');

    // Validate any per-token colors that are set.
    for (const mt of line.tokens) {
        if (mt.token.color !== undefined) {
            assertValidColor(mt.token.color, `token color (text: "${mt.token.text}")`);
        }
    }

    if (options.shadow) assertValidShadow(options.shadow, 'top-level');
    for (const mt of line.tokens) {
        if (mt.token.shadow !== undefined) {
            assertValidShadow(mt.token.shadow, `token (text: "${mt.token.text}")`);
        }
    }

    // Collect unique blur radii used by shadows in this line for filter dedup.
    const blurKeys = new Set<string>();
    for (const mt of line.tokens) {
        const eff = mt.token.shadow ?? options.shadow;
        if (!eff) continue;
        const { blurPx } = shadowDeltas(eff, mt.token.size);
        if (blurPx > 0) blurKeys.add(blurKey(blurPx));
    }

    const bbox = line.tightBbox;

    // Expand tight bbox by the max shadow extent on each side so the viewBox
    // includes the shadow. Without this the shadow renders past the viewport
    // and viewers clip it.
    const infl = shadowInflation([line], options.shadow);

    const width = bbox.width + padding * 2 + infl.left + infl.right;
    const height = bbox.height + padding * 2 + infl.top + infl.bottom;

    // Offset to translate paths so tight bbox starts at (padding + infl.left,
    // padding + infl.top) — leaves room for shadow on the negative side.
    const offsetX = -bbox.x1 + padding + infl.left;
    const offsetY = -bbox.y1 + padding + infl.top;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" overflow="visible"`;
    if (background) {
        svg += ` style="background: ${background}"`;
    }
    svg += '>\n';

    if (blurKeys.size > 0) {
        svg += '  <defs>\n';
        for (const key of blurKeys) {
            svg += `    <filter id="${filterId(key)}" x="-50%" y="-50%" width="200%" height="200%">\n`;
            svg += `      <feGaussianBlur stdDeviation="${key}"/>\n`;
            svg += '    </filter>\n';
        }
        svg += '  </defs>\n';
    }

    // Debug: show border (exact bounds)
    if (showBorder) {
        svg += `  <rect x="0" y="0" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="none" stroke="blue" stroke-width="0.5"/>\n`;
    }

    // Debug: show baseline (relative to tight bounds)
    if (showBaseline) {
        const baselineY = line.baseline + offsetY;
        svg += `  <line x1="0" y1="${baselineY.toFixed(2)}" x2="${width.toFixed(2)}" y2="${baselineY.toFixed(2)}" stroke="red" stroke-width="0.5" stroke-dasharray="2"/>\n`;
    }

    // Render each token path, translated to start at padding
    for (const measured of line.tokens) {
        const pathData = measured.path.toPathData(2);
        const fill = measured.token.color ?? color;
        const eff = measured.token.shadow ?? options.shadow;
        svg += `  <g transform="translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})">\n`;
        if (eff) {
            const { dx, dy, blurPx, color: shadowColor } = shadowDeltas(eff, measured.token.size);
            const shadowGroupAttrs = blurPx > 0
                ? ` filter="url(#${filterId(blurKey(blurPx))})"`
                : '';
            svg += `    <g transform="translate(${dx.toFixed(2)}, ${dy.toFixed(2)})"${shadowGroupAttrs}>\n`;
            svg += `      <path d="${pathData}" fill="${shadowColor}"/>\n`;
            svg += '    </g>\n';
        }
        svg += `    <path d="${pathData}" fill="${fill}"/>\n`;
        svg += `  </g>\n`;
    }

    svg += '</svg>';
    return svg;
}

/**
 * Render a PositionedLayout to SVG
 */
export function layoutToSVG(
    layout: PositionedLayout,
    options: {
        padding?: number;
        background?: string;
        color?: string;
        /** Top-level shadow default; per-token `token.shadow` overrides. */
        shadow?: Shadow;
        annotate?: boolean;
    } = {}
): string {
    const { padding = 0, background, color = 'black', annotate = false } = options;

    if (options.color) assertValidColor(options.color, 'color');
    if (options.background) assertValidColor(options.background, 'background');

    // Validate any per-token colors that are set.
    for (const posLine of layout.lines) {
        for (const mt of posLine.measured.tokens) {
            if (mt.token.color !== undefined) {
                assertValidColor(mt.token.color, `token color (text: "${mt.token.text}")`);
            }
        }
    }

    if (options.shadow) assertValidShadow(options.shadow, 'top-level');
    for (const posLine of layout.lines) {
        for (const mt of posLine.measured.tokens) {
            if (mt.token.shadow !== undefined) {
                assertValidShadow(mt.token.shadow, `token (text: "${mt.token.text}")`);
            }
        }
    }

    const blurKeys = new Set<string>();
    for (const posLine of layout.lines) {
        for (const mt of posLine.measured.tokens) {
            const eff = mt.token.shadow ?? options.shadow;
            if (!eff) continue;
            const { blurPx } = shadowDeltas(eff, mt.token.size);
            if (blurPx > 0) blurKeys.add(blurKey(blurPx));
        }
    }

    if (layout.lines.length === 0) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" viewBox="0 0 0 0"></svg>';
    }

    // Expand the viewBox to include shadow extent — layout.width/height are
    // shadow-blind (they come from raw glyph paths), so without this the
    // shadow renders past the viewport and viewers clip it.
    const infl = shadowInflation(layout.lines.map(l => l.measured), options.shadow);

    const width = layout.width + padding * 2 + infl.left + infl.right;
    const height = layout.height + padding * 2 + infl.top + infl.bottom;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" overflow="visible"`;
    if (background) {
        svg += ` style="background: ${background}"`;
    }
    svg += '>\n';

    if (blurKeys.size > 0) {
        svg += '  <defs>\n';
        for (const key of blurKeys) {
            svg += `    <filter id="${filterId(key)}" x="-50%" y="-50%" width="200%" height="200%">\n`;
            svg += `      <feGaussianBlur stdDeviation="${key}"/>\n`;
            svg += '    </filter>\n';
        }
        svg += '  </defs>\n';
    }

    // First pass: render all text paths
    for (const posLine of layout.lines) {
        const lineOffsetX = posLine.x + padding + infl.left;
        const lineOffsetY = posLine.y + padding + infl.top;

        for (const measured of posLine.measured.tokens) {
            if (measured.path.commands.length === 0) continue;
            const pathData = measured.path.toPathData(2);
            const fill = measured.token.color ?? color;
            const eff = measured.token.shadow ?? options.shadow;
            svg += `  <g transform="translate(${lineOffsetX.toFixed(2)}, ${lineOffsetY.toFixed(2)})">\n`;
            if (eff) {
                const { dx, dy, blurPx, color: shadowColor } = shadowDeltas(eff, measured.token.size);
                const shadowGroupAttrs = blurPx > 0
                    ? ` filter="url(#${filterId(blurKey(blurPx))})"`
                    : '';
                svg += `    <g transform="translate(${dx.toFixed(2)}, ${dy.toFixed(2)})"${shadowGroupAttrs}>\n`;
                svg += `      <path d="${pathData}" fill="${shadowColor}"/>\n`;
                svg += '    </g>\n';
            }
            svg += `    <path d="${pathData}" fill="${fill}"/>\n`;
            svg += `  </g>\n`;
        }
    }

    // Second pass: render annotation elements on top
    if (annotate) {
        for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
            const posLine = layout.lines[lineIdx];
            const lineOffsetX = posLine.x + padding + infl.left;
            const baselineY = posLine.baseline + padding + infl.top;

            // Green box around line's tight bounding box
            const lineVisualY = posLine.y + padding + infl.top + posLine.measured.tightBbox.y1;
            svg += `  <rect x="${(lineOffsetX + posLine.measured.tightBbox.x1).toFixed(2)}" y="${lineVisualY.toFixed(2)}" `;
            svg += `width="${posLine.width.toFixed(2)}" height="${posLine.height.toFixed(2)}" `;
            svg += `fill="none" stroke="green" stroke-width="1"/>\n`;

            // Red dashed baseline
            svg += `  <line x1="0" y1="${baselineY.toFixed(2)}" x2="${width.toFixed(2)}" y2="${baselineY.toFixed(2)}" `;
            svg += `stroke="red" stroke-width="0.5" stroke-dasharray="4,2"/>\n`;

            // Blue box around each token's bounding box
            for (const measured of posLine.measured.tokens) {
                if (measured.path.commands.length > 0) {
                    const tokenY = posLine.y + padding + infl.top + measured.bboxY1;
                    svg += `  <rect x="${(lineOffsetX + measured.bboxX1).toFixed(2)}" y="${tokenY.toFixed(2)}" `;
                    svg += `width="${(measured.bboxX2 - measured.bboxX1).toFixed(2)}" height="${(measured.bboxY2 - measured.bboxY1).toFixed(2)}" `;
                    svg += `fill="none" stroke="blue" stroke-width="0.5"/>\n`;
                }
            }

            // Red vertical spacing indicator (baseline to baseline)
            if (lineIdx < layout.lines.length - 1) {
                const nextLine = layout.lines[lineIdx + 1];
                const nextBaselineY = nextLine.baseline + padding + infl.top;
                const baselineDistance = nextBaselineY - baselineY;
                const midX = width - 20;

                svg += `  <line x1="${midX.toFixed(2)}" y1="${baselineY.toFixed(2)}" x2="${midX.toFixed(2)}" y2="${nextBaselineY.toFixed(2)}" `;
                svg += `stroke="red" stroke-width="2"/>\n`;
                svg += `  <line x1="${(midX - 5).toFixed(2)}" y1="${baselineY.toFixed(2)}" x2="${(midX + 5).toFixed(2)}" y2="${baselineY.toFixed(2)}" `;
                svg += `stroke="red" stroke-width="1"/>\n`;
                svg += `  <line x1="${(midX - 5).toFixed(2)}" y1="${nextBaselineY.toFixed(2)}" x2="${(midX + 5).toFixed(2)}" y2="${nextBaselineY.toFixed(2)}" `;
                svg += `stroke="red" stroke-width="1"/>\n`;
                svg += `  <text x="${(midX + 8).toFixed(2)}" y="${((baselineY + nextBaselineY) / 2 + 4).toFixed(2)}" `;
                svg += `font-size="10" fill="red">${baselineDistance.toFixed(1)}px</text>\n`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}
