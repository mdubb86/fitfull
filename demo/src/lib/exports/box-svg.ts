// Wrap fitfull's tight-bbox SVG in a box-sized outer SVG, positioning the
// text per box.align and painting box.bgColor as a fill rect if set. Used by
// both SVG and PNG export so what the user sees in the canvas (a box with
// text positioned in it) matches what they get in the exported file.

import { fit } from '$lib/fitfull/fit.svelte';
import { box } from '$lib/state/box.svelte';

/** Returns a complete SVG string sized to the box (or '' if no fit yet). */
export function buildBoxSizedSvg(): string {
    if (!fit.result) return '';
    const inner = fit.result.svg;

    const widthMatch = inner.match(/width="([^"]+)"/);
    const heightMatch = inner.match(/height="([^"]+)"/);
    const textW = widthMatch ? parseFloat(widthMatch[1]) : 0;
    const textH = heightMatch ? parseFloat(heightMatch[1]) : 0;

    const boxW = box.width;
    const boxH = box.height;

    // Horizontal position per align; vertical always centered (fitfull's
    // align spec is horizontal-only).
    const ox = box.align === 'left'  ? 0
             : box.align === 'right' ? boxW - textW
             : (boxW - textW) / 2;
    const oy = (boxH - textH) / 2;

    const bg = box.bgColor
        ? `<rect width="${boxW}" height="${boxH}" fill="${box.bgColor}"/>`
        : '';

    // Drop the inner SVG's xmlns (outer has it) and add x/y position attrs.
    const positionedInner = inner
        .replace(/\s*xmlns="[^"]*"/, '')
        .replace(/<svg/, `<svg x="${ox.toFixed(2)}" y="${oy.toFixed(2)}"`);

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}" ` +
        `viewBox="0 0 ${boxW} ${boxH}">${bg}${positionedInner}</svg>`
    );
}
