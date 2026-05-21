import { fit } from '$lib/fitfull/fit.svelte';
import { buildBoxSizedSvg } from './box-svg';
import { deriveFilename } from './filename';

export function downloadSvg(filename = deriveFilename('svg')) {
    if (!fit.result) return;
    const blob = new Blob([buildBoxSizedSvg()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
