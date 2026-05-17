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
