// Module-singleton: import { box } from '$lib/state/box.svelte' anywhere.
// Mutations propagate reactively to all consumers via Svelte 5 runes.

type WrapMode = 'balanced' | 'greedy';
type Align = 'left' | 'center' | 'right';

class BoxState {
    width = $state(500);
    height = $state(300);
    wrap = $state<WrapMode>('balanced');
    align = $state<Align>('center');
    lineSpacing = $state(1.0);
    /** Bounds on arrangements fitfull tries. Without an upper cap, long
     *  inputs blow up the search and hit the timeout. Range 1-10 covers
     *  realistic headline cases; users can pin a tighter band (e.g. 2-3
     *  for a strict two-or-three-line layout). */
    minLines = $state(1);
    maxLines = $state(4);
    /** Document-level default text color for tokens without their own. */
    textColor = $state('#000000');
    /** Canvas background color baked into the SVG/PNG export. null = transparent. */
    bgColor = $state<string | null>(null);

    get aspect() {
        return this.width / this.height;
    }

    setDims(w: number, h: number) {
        this.width = Math.max(16, Math.min(7680, Math.round(w)));
        this.height = Math.max(16, Math.min(7680, Math.round(h)));
    }
}

export const box = new BoxState();
