import { Fitfull, type FitResult } from 'fitfull/browser';
import { box } from '$lib/state/box.svelte';
import { doc } from '$lib/state/document.svelte';
import { theme } from '$lib/state/theme.svelte';

/** Default text color when a token doesn't carry its own. Matches the warm
 *  near-black/near-white surface ramp in fitfull-console.css. */
function defaultColor(): string {
    return theme.mode === 'dark' ? '#f5f4f0' : '#0d0c0a';
}

/**
 * Reactive wrapper around fitfull's fit() pipeline. Singleton.
 * Phase 4: input is the live `doc.tokens` (driven by WYSIWYG or Tokens editor).
 * Phase 5 registers fonts so the fit actually succeeds.
 */
class FitState {
    /** Last successful FitResult. Null on first run and on fitfull errors. */
    result = $state<FitResult | null>(null);
    state = $state<'fit' | 'resizing' | 'fitting'>('fit');
    durationMs = $state(0);
    error = $state<string | null>(null);

    private ff = new Fitfull();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async runFit() {
        this.state = 'fitting';
        this.error = null;
        const t0 = performance.now();
        try {
            const res = await this.ff.fit({
                tokens: doc.tokens,
                width: box.width,
                height: box.height,
                wrap: box.wrap,
                align: box.align,
                lineSpacing: box.lineSpacing,
                color: defaultColor(),
            });
            this.result = res;
            this.durationMs = Math.round(performance.now() - t0);
            this.state = 'fit';
        } catch (e) {
            this.error = (e as Error).message;
            this.state = 'fit';  // not 'error' — leave the previous result visible
            // (When fonts aren't registered yet — Phases 1-4 — this catches "Font not registered" silently.)
        }
    }

    /** Debounce re-fits so dragging doesn't trigger 60 fits/sec. */
    scheduleFit(delay = 150) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.state = 'resizing';
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.runFit();
        }, delay);
    }

    registerFont(family: string, weight: 'regular' | 'bold' | 'italic' | 'bolditalic', bytes: ArrayBuffer | Uint8Array) {
        this.ff.registerFont(family, weight, bytes);
    }
}

export const fit = new FitState();

// Refit on token changes (doc.tokens flows from WYSIWYG or Tokens editor)
// AND on theme change — the default color depends on theme.mode, so a
// theme flip needs to re-render so untinted text contrasts the new bg.
// Module-scope effect — needs $effect.root so it isn't tied to a component.
$effect.root(() => {
    $effect(() => {
        doc.tokens;   // tracked dep
        theme.mode;   // tracked dep — re-fit when light/dark flips
        fit.scheduleFit();
    });
});
