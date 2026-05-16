/**
 * Injects font bytes as a `FontFace` into `document.fonts` so the editor
 * DOM (TipTap / preview chips / etc.) renders using the same font fitfull
 * lays out with on the canvas.
 *
 * Same bytes, two consumers — fitfull (via `BrowserFontManager.registerFont`)
 * and the browser's CSS Font Loading API (here).
 *
 * See `docs/superpowers/research/2026-05-16-google-fonts.md` § 4.
 */
import type { FontWeight } from 'fitfull';

interface Descriptor {
    weight: '400' | '700';
    style: 'normal' | 'italic';
}

function describe(weight: FontWeight): Descriptor {
    switch (weight) {
        case 'regular':
            return { weight: '400', style: 'normal' };
        case 'bold':
            return { weight: '700', style: 'normal' };
        case 'italic':
            return { weight: '400', style: 'italic' };
        case 'bolditalic':
            return { weight: '700', style: 'italic' };
    }
}

function injectionKey(family: string, weight: FontWeight | string): string {
    return `${family}|${weight}`;
}

const installed = new Map<string, FontFace>();

/**
 * Construct a `FontFace` from the provided bytes, load it, and add it to
 * `document.fonts`. Deduped on `${family}|${weight}` — calling twice with
 * the same key returns the cached `FontFace` without re-loading.
 *
 * SSR-safe: returns a stub `FontFace` if `document` is not defined.
 */
export async function injectFontFace(
    family: string,
    weight: FontWeight,
    bytes: ArrayBuffer,
): Promise<FontFace> {
    const key = injectionKey(family, weight);
    const existing = installed.get(key);
    if (existing) return existing;

    if (typeof document === 'undefined') {
        // SSR — return an unloaded FontFace if the constructor exists, else throw.
        // Practically this branch should never be taken because callers gate on
        // `browser` (Svelte) or run inside event handlers.
        if (typeof FontFace === 'undefined') {
            throw new Error('injectFontFace called outside a browser environment');
        }
        return new FontFace(family, bytes, describe(weight));
    }

    const desc = describe(weight);
    const face = new FontFace(family, bytes, {
        weight: desc.weight,
        style: desc.style,
        display: 'swap',
    });
    await face.load();
    document.fonts.add(face);
    installed.set(key, face);
    return face;
}

/**
 * Remove a previously-injected face from `document.fonts` and the dedupe map.
 *
 * Accepts both `FitfullWeight` and the raw key string for symmetry with the
 * injection key. No-op if the face isn't installed.
 */
export function removeFontFace(family: string, weight: FontWeight | string): void {
    const key = injectionKey(family, weight);
    const face = installed.get(key);
    if (!face) return;
    if (typeof document !== 'undefined') {
        document.fonts.delete(face);
    }
    installed.delete(key);
}
