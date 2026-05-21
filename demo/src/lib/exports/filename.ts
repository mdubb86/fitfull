import { fit } from '$lib/fitfull/fit.svelte';

const MAX_LEN = 50;

export function deriveFilename(ext: 'svg' | 'png'): string {
    const text = (fit.result?.lines ?? []).join(' ');
    const slug = text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_LEN)
        .replace(/-+$/, '');
    return `${slug || 'fitfull'}.${ext}`;
}
