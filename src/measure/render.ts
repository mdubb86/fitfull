import type { MeasuredLine, PositionedLayout } from '../types.js';

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

    const bbox = line.tightBbox;

    // SVG dimensions - use exact values for tight fit
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;

    // Offset to translate paths so tight bbox starts at (padding, padding)
    const offsetX = -bbox.x1 + padding;
    const offsetY = -bbox.y1 + padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" overflow="visible"`;
    if (background) {
        svg += ` style="background: ${background}"`;
    }
    svg += '>\n';

    // Debug: show border (exact bounds)
    if (showBorder) {
        svg += `  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="blue" stroke-width="0.5"/>\n`;
    }

    // Debug: show baseline (relative to tight bounds)
    if (showBaseline) {
        const baselineY = line.baseline + offsetY;
        svg += `  <line x1="0" y1="${baselineY}" x2="${width}" y2="${baselineY}" stroke="red" stroke-width="0.5" stroke-dasharray="2"/>\n`;
    }

    // Render each token path, translated to start at padding
    for (const measured of line.tokens) {
        const pathData = measured.path.toPathData(2);
        svg += `  <g transform="translate(${offsetX}, ${offsetY})">\n`;
        svg += `    <path d="${pathData}" fill="${color}"/>\n`;
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

    if (layout.lines.length === 0) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';
    }

    const width = layout.width + padding * 2;
    const height = layout.height + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" overflow="visible"`;
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
            svg += `  <g transform="translate(${lineOffsetX}, ${lineOffsetY})">\n`;
            svg += `    <path d="${pathData}" fill="${color}"/>\n`;
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
            svg += `  <rect x="${lineOffsetX + posLine.measured.tightBbox.x1}" y="${lineVisualY}" `;
            svg += `width="${posLine.width}" height="${posLine.height}" `;
            svg += `fill="none" stroke="green" stroke-width="1"/>\n`;

            // Red dashed baseline
            svg += `  <line x1="0" y1="${baselineY}" x2="${width}" y2="${baselineY}" `;
            svg += `stroke="red" stroke-width="0.5" stroke-dasharray="4,2"/>\n`;

            // Blue box around each token's bounding box
            for (const measured of posLine.measured.tokens) {
                if (measured.path.commands.length > 0) {
                    const tokenY = posLine.y + padding + measured.bboxY1;
                    svg += `  <rect x="${lineOffsetX + measured.bboxX1}" y="${tokenY}" `;
                    svg += `width="${measured.bboxX2 - measured.bboxX1}" height="${measured.bboxY2 - measured.bboxY1}" `;
                    svg += `fill="none" stroke="blue" stroke-width="0.5"/>\n`;
                }
            }

            // Red vertical spacing indicator (baseline to baseline)
            if (lineIdx < layout.lines.length - 1) {
                const nextLine = layout.lines[lineIdx + 1];
                const nextBaselineY = nextLine.baseline + padding;
                const baselineDistance = nextBaselineY - baselineY;
                const midX = width - 20;

                svg += `  <line x1="${midX}" y1="${baselineY}" x2="${midX}" y2="${nextBaselineY}" `;
                svg += `stroke="red" stroke-width="2"/>\n`;
                svg += `  <line x1="${midX - 5}" y1="${baselineY}" x2="${midX + 5}" y2="${baselineY}" `;
                svg += `stroke="red" stroke-width="1"/>\n`;
                svg += `  <line x1="${midX - 5}" y1="${nextBaselineY}" x2="${midX + 5}" y2="${nextBaselineY}" `;
                svg += `stroke="red" stroke-width="1"/>\n`;
                svg += `  <text x="${midX + 8}" y="${(baselineY + nextBaselineY) / 2 + 4}" `;
                svg += `font-size="10" fill="red">${baselineDistance.toFixed(1)}px</text>\n`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}
