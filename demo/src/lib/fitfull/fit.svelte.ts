import { Fitfull, type FitResult } from 'fitfull/browser';
import { box } from '$lib/state/box.svelte';

/**
 * Reactive wrapper around fitfull's fit() pipeline. Singleton.
 * Phase 2: input is a hardcoded text + 'Geist' font. Phase 4 swaps to live document tokens.
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
            // fitfull's Alignment is 'left' | 'center' | 'right'. The demo also
            // exposes 'justify' in the UI; downgrade it to 'left' for now (Phase 4+
            // will decide the final semantics for justify).
            const align = box.align === 'justify' ? 'left' : box.align;
            const res = await this.ff.fit({
                text: 'Hello world',
                font: 'Geist',         // Phase 5 will register this from Google Fonts
                fontWeight: 'regular',
                width: box.width,
                height: box.height,
                wrap: box.wrap,
                align,
                lineSpacing: box.lineSpacing,
            });
            this.result = res;
            this.durationMs = Math.round(performance.now() - t0);
            this.state = 'fit';
        } catch (e) {
            this.error = (e as Error).message;
            this.state = 'fit';  // not 'error' — leave the previous result visible
            // (When fonts aren't registered yet — Phase 2 — this catches "Font not registered" silently.)
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
