// Module-singleton: import { fonts } from '$lib/state/fonts.svelte' anywhere.
// Tracks added (family, weight) pairs and their load state. Adding a font
// runs cache→bytes→inject→fit.registerFont→fit.scheduleFit. See Phase 5.

import { getFontBytes } from '$lib/fonts/cache';
import { fetchFontBytes } from '$lib/fonts/google-fonts';
import { injectFontFace, removeFontFace } from '$lib/fonts/font-face';
import { fit } from '$lib/fitfull/fit.svelte';
import { doc } from '$lib/state/document.svelte';
import type { FontWeight } from 'fitfull';

export type LoadStatus = 'loading' | 'loaded' | 'error';

export interface WeightEntry {
    weight: FontWeight;
    status: LoadStatus;
    error?: string;
    /** Number of tokens in the current doc that reference this (family, weight). */
    runs: number;
}

interface InternalEntry {
    family: string;
    weights: Map<FontWeight, { status: LoadStatus; error?: string }>;
}

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

    /** Weight entries for a family, including run counts from doc.tokens. */
    weightStatuses(family: string): WeightEntry[] {
        const entry = this.entries.get(family);
        if (!entry) return [];
        // Compute runs per weight from doc.tokens — reactive read, recomputes
        // whenever the doc changes.
        const runsByWeight = new Map<FontWeight, number>();
        for (const tok of doc.tokens) {
            if (tok.font === family) {
                runsByWeight.set(tok.weight, (runsByWeight.get(tok.weight) ?? 0) + 1);
            }
        }
        const out: WeightEntry[] = [];
        for (const [weight, st] of entry.weights) {
            out.push({
                weight,
                status: st.status,
                error: st.error,
                runs: runsByWeight.get(weight) ?? 0,
            });
        }
        return out;
    }

    /** Add (or queue load for) a family/weight. Idempotent. */
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

    /** Remove all weights of a family. No-op if any weight is in-use (runs > 0). */
    removeFont(family: string): { ok: boolean; reason?: string } {
        const statuses = this.weightStatuses(family);
        const inUse = statuses.filter((w) => w.runs > 0);
        if (inUse.length > 0) {
            return {
                ok: false,
                reason: `In use by ${inUse.reduce((sum, w) => sum + w.runs, 0)} run(s); change those tokens first.`,
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
