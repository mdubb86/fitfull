import { Fitfull, type FitResult } from 'fitfull/browser';
import { box } from '$lib/state/box.svelte';
import { doc } from '$lib/state/document.svelte';

/**
 * Reactive wrapper around fitfull's fit() pipeline. Singleton.
 * Phase 4: input is the live `doc.tokens` (driven by WYSIWYG or Tokens editor).
 * Phase 5 registers fonts so the fit actually succeeds.
 */
class FitState {
    /** Last successful FitResult. Null on first run and on fitfull errors. */
    result = $state<FitResult | null>(null);
    /** Box dims used for the last successful fit. Needed for occupancy
     *  calculation — consumers must NOT use live box.width/height because
     *  those change while dragging before fitfull re-runs, producing a
     *  jittery ratio against stale text dims. */
    fitBoxW = $state(0);
    fitBoxH = $state(0);
    state = $state<'fit' | 'settling' | 'fitting' | 'error'>('fit');
    durationMs = $state(0);
    error = $state<string | null>(null);

    private ff = new Fitfull();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async runFit() {
        this.state = 'fitting';
        // Clear any previous error so a successful re-fit removes the red pip.
        this.error = null;
        const t0 = performance.now();
        try {
            // Snapshot box dims for the occupancy calc — must match the dims
            // fitfull used for THIS run, not the live box state.
            const w = box.width;
            const h = box.height;
            const fitOpts: Parameters<typeof this.ff.fit>[0] = {
                tokens: doc.tokens,
                width: w,
                height: h,
                wrap: box.wrap,
                align: box.align,
                lineSpacing: box.lineSpacing,
                minLines: box.minLines,
                maxLines: box.maxLines,
                color: box.textColor,
            };
            // Only pass `background` when explicitly set — otherwise fitfull
            // renders no bg rect and the SVG/PNG export stays transparent.
            if (box.bgColor) fitOpts.background = box.bgColor;
            // Only pass `shadow` when explicitly set — omitting lets fitfull
            // default to no shadow rather than forwarding a null sentinel.
            if (box.shadow) fitOpts.shadow = box.shadow;
            const res = await this.ff.fit(fitOpts);
            this.result = res;
            this.fitBoxW = w;
            this.fitBoxH = h;
            this.durationMs = Math.round(performance.now() - t0);
            this.state = 'fit';
        } catch (e) {
            // Keep the last successful result on canvas so the user has SOMETHING
            // to see, but flip state to 'error' so the UI can surface the failure
            // (otherwise the canvas just looks stale and the user thinks edits
            // are being ignored).
            this.error = (e as Error).message;
            this.state = 'error';
        }
    }

    /** Debounce re-fits so dragging doesn't trigger 60 fits/sec. */
    scheduleFit(delay = 150) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.state = 'settling';
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

// Refit on token changes AND on text/bg color changes — those flow into the
// rendered SVG output so a change requires a re-render. Box dims/wrap/align/
// spacing are already handled by Canvas.svelte's effect on drag end.
$effect.root(() => {
    $effect(() => {
        doc.tokens;
        box.textColor;
        box.bgColor;
        fit.scheduleFit();
    });
});
