import { fit } from '$lib/fitfull/fit.svelte';

export async function downloadPng(
    filename = 'fitfull-headline.png',
    scale = 1,
) {
    if (!fit.result) return;
    const svgBlob = new Blob([fit.result.svg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const img = new Image();
        img.src = svgUrl;
        await img.decode();
        // Use the SVG's natural dimensions (set by fitfull). 1:1 scale matches
        // the CLI which uses resvg's `fitTo: 'original'` — no upscaling.
        const w = img.naturalWidth || fit.result.width;
        const h = img.naturalHeight || fit.result.height;
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
