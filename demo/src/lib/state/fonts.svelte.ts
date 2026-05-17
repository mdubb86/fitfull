// Module-singleton: import { fonts } from '$lib/state/fonts.svelte' anywhere.
// Tracks added (family, weight) pairs and their load state. Adding a font
// runs cache→bytes→inject→fit.registerFont→fit.scheduleFit. See Phase 5.

import { getFontBytes } from '$lib/fonts/cache';
import { fetchFontBytes } from '$lib/fonts/google-fonts';
import { injectFontFace, removeFontFace } from '$lib/fonts/font-face';
import { fit } from '$lib/fitfull/fit.svelte';
import { doc } from '$lib/state/document.svelte';
import { getCatalog, type FontFamily } from '$lib/fonts/catalog';
import type { FontWeight } from 'fitfull';

// Bundled default fonts — already exposed as @font-face by the @fontsource
// CSS imports in app.css, so we only need to hand the bytes to fitfull.
// ?url returns the asset URL Vite resolves to the file.
import geistRegularUrl from '@fontsource/geist/files/geist-latin-400-normal.woff2?url';
import geistBoldUrl from '@fontsource/geist/files/geist-latin-700-normal.woff2?url';
import playfairRegularUrl from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfairItalicUrl from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';

export type LoadStatus = 'loading' | 'loaded' | 'error';

interface InternalEntry {
    family: string;
    weights: Map<FontWeight, { status: LoadStatus; error?: string }>;
}

// Catalog is loaded eagerly from the virtual module (sync). Build a name → entry
// map once at module init so loadFamily lookups are O(1).
const catalogByName: Map<string, FontFamily> = new Map(getCatalog().map((f) => [f.family, f]));

class FontRegistry {
    // Keep entries in a Map so iteration order is insertion order = display order.
    // Wrap in $state so Svelte components reactively pick up changes. Inner Map
    // mutations don't trigger reactivity on their own — we replace the Map after
    // every change (see force-trigger comments below).
    private entries = $state<Map<string, InternalEntry>>(new Map());

    /** All registered families (insertion order). */
    families(): string[] {
        return [...this.entries.keys()];
    }

    /**
     * Aggregate load status for a family across all its weights.
     * - 'unknown' if family not in registry
     * - 'loading' if ANY weight is still loading
     * - 'error' if ALL weights have errored
     * - 'loaded' otherwise (at least one weight loaded)
     */
    familyStatus(family: string): 'loading' | 'loaded' | 'error' | 'unknown' {
        const entry = this.entries.get(family);
        if (!entry || entry.weights.size === 0) return 'unknown';
        let allError = true;
        for (const { status } of entry.weights.values()) {
            if (status === 'loading') return 'loading';
            if (status !== 'error') allError = false;
        }
        return allError ? 'error' : 'loaded';
    }

    /** Whether a given style is loaded for a family. Used to enable/disable B & I. */
    supportsStyle(family: string, style: 'bold' | 'italic' | 'bolditalic'): boolean {
        const entry = this.entries.get(family);
        if (!entry) return false;
        const st = entry.weights.get(style);
        return st?.status === 'loaded';
    }

    /** Number of doc tokens currently referencing this family (any weight). Reactive read via doc.tokens. */
    runs(family: string): number {
        let count = 0;
        for (const tok of doc.tokens) {
            if (tok.font === family) count++;
        }
        return count;
    }

    /**
     * Load all available styles (regular/bold/italic/bolditalic) for a family
     * from Google Fonts in parallel. Looks up which weights exist via getCatalog().
     * Idempotent — already-loaded weights are skipped. Resolves when all attempts settle.
     * No-op if the family isn't in the catalog (e.g. bundled fonts like Geist).
     */
    async loadFamily(family: string): Promise<void> {
        const entry = catalogByName.get(family);
        if (!entry) return;
        const targets: FontWeight[] = [];
        if (entry.variants.includes(400)) targets.push('regular');
        if (entry.variants.includes(700)) targets.push('bold');
        if (entry.italicVariants?.includes(400)) targets.push('italic');
        if (entry.italicVariants?.includes(700)) targets.push('bolditalic');
        await Promise.all(targets.map((w) => this.addFont(family, w)));
    }

    /** Add (or queue load for) a family/weight. Idempotent. Internal — callers use loadFamily. */
    async addFont(family: string, weight: FontWeight): Promise<void> {
        let entry = this.entries.get(family);
        if (!entry) {
            entry = { family, weights: new Map() };
            this.entries.set(family, entry);
            this.entries = new Map(this.entries); // force reactive trigger
        }
        if (entry.weights.has(weight)) {
            const st = entry.weights.get(weight)!.status;
            if (st === 'loaded' || st === 'loading') return;
        }
        entry.weights.set(weight, { status: 'loading' });
        this.entries = new Map(this.entries);

        try {
            const bytes = await getFontBytes(family, weight, () => fetchFontBytes(family, weight));
            await injectFontFace(family, weight, bytes);
            fit.registerFont(family, weight, bytes);
            entry.weights.set(weight, { status: 'loaded' });
            this.entries = new Map(this.entries);
            fit.scheduleFit();
        } catch (e) {
            entry.weights.set(weight, { status: 'error', error: (e as Error).message });
            this.entries = new Map(this.entries);
        }
    }

    /**
     * Load the bundled default fonts (Geist + Playfair Display) and register
     * with fitfull so the canvas renders the default doc on first load.
     * Skips injectFontFace because @fontsource CSS imports already provide
     * @font-face via app.css. Doesn't go through loadFamily because these
     * are bundled rather than fetched from Google Fonts.
     */
    async loadDefault(): Promise<void> {
        const defaults: Array<{ family: string; weight: FontWeight; url: string }> = [
            { family: 'Geist',            weight: 'regular', url: geistRegularUrl },
            { family: 'Geist',            weight: 'bold',    url: geistBoldUrl },
            { family: 'Playfair Display', weight: 'regular', url: playfairRegularUrl },
            { family: 'Playfair Display', weight: 'italic',  url: playfairItalicUrl },
        ];

        // Pre-mark all as loading so the inventory shows them immediately.
        for (const { family, weight } of defaults) {
            let entry = this.entries.get(family);
            if (!entry) {
                entry = { family, weights: new Map() };
                this.entries.set(family, entry);
            }
            if (!entry.weights.has(weight)) entry.weights.set(weight, { status: 'loading' });
        }
        this.entries = new Map(this.entries);

        await Promise.all(
            defaults.map(async ({ family, weight, url }) => {
                const entry = this.entries.get(family)!;
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const bytes = await res.arrayBuffer();
                    fit.registerFont(family, weight, bytes);
                    entry.weights.set(weight, { status: 'loaded' });
                } catch (e) {
                    entry.weights.set(weight, { status: 'error', error: (e as Error).message });
                }
            }),
        );
        this.entries = new Map(this.entries);
        fit.scheduleFit();
    }

    /** Remove all weights of a family. No-op if any token still references it. */
    removeFont(family: string): { ok: boolean; reason?: string } {
        const inUse = this.runs(family);
        if (inUse > 0) {
            return {
                ok: false,
                reason: `In use by ${inUse} run(s); change those tokens first.`,
            };
        }
        const entry = this.entries.get(family);
        if (!entry) return { ok: true };
        for (const weight of entry.weights.keys()) {
            removeFontFace(family, weight);
            // fitfull v1.5.0 has no public deregisterFont — fit will silently keep
            // the registration, which is fine (no harm in extra registered fonts).
        }
        this.entries.delete(family);
        this.entries = new Map(this.entries);
        fit.scheduleFit();
        return { ok: true };
    }
}

export const fonts = new FontRegistry();

// Auto-kick the default-font load on module init in the browser. In dev,
// Vite's HMR can re-evaluate this module (e.g. when a dependent file changes),
// creating a fresh empty registry while the +layout component doesn't re-mount.
// Calling loadDefault here covers both initial mount and post-HMR reloads.
// Idempotent — addFont() short-circuits if the weight is already loaded.
if (typeof window !== 'undefined') {
    void fonts.loadDefault();
}
