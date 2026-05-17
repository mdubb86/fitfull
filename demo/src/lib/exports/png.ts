import { fit } from '$lib/fitfull/fit.svelte';
import { box } from '$lib/state/box.svelte';
import { buildBoxSizedSvg } from './box-svg';

export async function downloadPng(
    filename = 'fitfull-headline.png',
    scale = 1,
) {
    if (!fit.result) return;
    // Box-sized SVG so the PNG is the full box (with text positioned per align
    // and bgColor filled if set) — matches what the user sees in the canvas.
    const svgBlob = new Blob([buildBoxSizedSvg()], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const img = new Image();
        img.src = svgUrl;
        await img.decode();
        const w = box.width;
        const h = box.height;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas 2d context unavailable');
        ctx.drawImage(img, 0, 0, w * scale, h * scale);
        await new Promise<void>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('PNG encoding failed')); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                resolve();
            }, 'image/png');
        });
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}
