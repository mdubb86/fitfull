import type { MeasuredLine, PositionedLayout } from '../types.js';

const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/;

function assertValidColor(value: string, field: string): void {
    if (!CSS_COLOR_RE.test(value.trim())) {
        throw new Error(
            `Invalid ${field} color: "${value}". Use a CSS color (hex, rgb(), rgba(), hsl(), hsla(), or a named color).`
        );
    }
}

/**
 * Render a measured line to an SVG string
 */
export function lineToSVG(line: MeasuredLine, options: {
    padding?: number;
    background?: string;
    color?: string;
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

    const bbox = line.tightBbox;

    // SVG dimensions - use exact values for tight fit
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;

    // Offset to translate paths so tight bbox starts at (padding, padding)
    const offsetX = -bbox.x1 + padding;
    const offsetY = -bbox.y1 + padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" overflow="visible"`;
    if (background) {
        svg += ` style="background: ${background}"`;
    }
    svg += '>\n';

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
        svg += `  <g transform="translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})">\n`;
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

    if (layout.lines.length === 0) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" viewBox="0 0 0 0"></svg>';
    }

    const width = layout.width + padding * 2;
    const height = layout.height + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" overflow="visible"`;
    if (background) {
        svg += ` style="background: ${background}"`;
    }
    svg += '>\n';

    // First pass: render all text paths
    for (const posLine of layout.lines) {
        const lineOffsetX = posLine.x + padding;
        const lineOffsetY = posLine.y + padding;

        for (const measured of posLine.measured.tokens) {
            if (measured.path.commands.length === 0) continue;
            const pathData = measured.path.toPathData(2);
            const fill = measured.token.color ?? color;
            svg += `  <g transform="translate(${lineOffsetX.toFixed(2)}, ${lineOffsetY.toFixed(2)})">\n`;
            svg += `    <path d="${pathData}" fill="${fill}"/>\n`;
            svg += `  </g>\n`;
        }
    }

    // Second pass: render annotation elements on top
    if (annotate) {
        for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
            const posLine = layout.lines[lineIdx];
            const lineOffsetX = posLine.x + padding;
            const baselineY = posLine.baseline + padding;

            // Green box around line's tight bounding box
            const lineVisualY = posLine.y + padding + posLine.measured.tightBbox.y1;
            svg += `  <rect x="${(lineOffsetX + posLine.measured.tightBbox.x1).toFixed(2)}" y="${lineVisualY.toFixed(2)}" `;
            svg += `width="${posLine.width.toFixed(2)}" height="${posLine.height.toFixed(2)}" `;
            svg += `fill="none" stroke="green" stroke-width="1"/>\n`;

            // Red dashed baseline
            svg += `  <line x1="0" y1="${baselineY.toFixed(2)}" x2="${width.toFixed(2)}" y2="${baselineY.toFixed(2)}" `;
            svg += `stroke="red" stroke-width="0.5" stroke-dasharray="4,2"/>\n`;

            // Blue box around each token's bounding box
            for (const measured of posLine.measured.tokens) {
                if (measured.path.commands.length > 0) {
                    const tokenY = posLine.y + padding + measured.bboxY1;
                    svg += `  <rect x="${(lineOffsetX + measured.bboxX1).toFixed(2)}" y="${tokenY.toFixed(2)}" `;
                    svg += `width="${(measured.bboxX2 - measured.bboxX1).toFixed(2)}" height="${(measured.bboxY2 - measured.bboxY1).toFixed(2)}" `;
                    svg += `fill="none" stroke="blue" stroke-width="0.5"/>\n`;
                }
            }

            // Red vertical spacing indicator (baseline to baseline)
            if (lineIdx < layout.lines.length - 1) {
                const nextLine = layout.lines[lineIdx + 1];
                const nextBaselineY = nextLine.baseline + padding;
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
