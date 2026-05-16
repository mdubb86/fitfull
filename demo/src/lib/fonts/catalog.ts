/**
 * Google Fonts catalog — slimmed at build time by the `fitfull-fonts-catalog`
 * Vite plugin (see demo/vite.config.ts). Sourced from the `google-font-metadata`
 * npm package; we keep only the fields the picker needs.
 *
 * Browser fetch of fonts.google.com/metadata/fonts is CORS-blocked, so the
 * virtual module is how the data reaches the bundle.
 *
 * See `docs/superpowers/research/2026-05-16-google-fonts.md` § 1.
 */

import catalog from 'virtual:fonts-catalog';

export interface FontFamily {
    /** Human-readable family name, e.g. "Inter" or "Source Sans 3". */
    family: string;
    /** "Sans Serif" | "Serif" | "Display" | "Handwriting" | "Monospace". */
    category: string;
    /** Numeric weights with a normal style, e.g. [400, 500, 700]. */
    variants: number[];
    /** Numeric weights with an italic counterpart, e.g. [400, 700]. */
    italicVariants?: number[];
}

export function getCatalog(): FontFamily[] {
    return catalog as FontFamily[];
}
