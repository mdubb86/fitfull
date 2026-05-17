// Module-singleton: URL hash state syncer.
//
// Encodes the demo's user-meaningful state (doc, box, registered font families)
// as gzip+base64url in `location.hash`. Two flows:
//
//   - OUTBOUND: a debounced $effect.root watches doc/box/fonts and writes the
//     hash via history.replaceState (~500 ms after the last edit), so editing
//     the demo always keeps the URL shareable without polluting back/forward.
//   - INBOUND: applyHashFromUrl() reads the hash and rehydrates the singletons
//     (called once at app mount, and on every `hashchange` for back/forward).
//
// A module-scope `suppressPush` flag prevents the inbound applier's writes
// from re-triggering the outbound effect (which would push another identical
// hash, no-op'ing but waking the timer). Encoded payload is also compared
// against the current hash before writing, so even without the flag we
// wouldn't loop — the flag is belt-and-suspenders for the multi-write burst
// during restoration.

import pako from 'pako';
import { doc } from '$lib/state/document.svelte';
import { box } from '$lib/state/box.svelte';
import { fonts } from '$lib/state/fonts.svelte';

interface SharedState {
    v: 1;
    doc: any;
    box: {
        w: number;
        h: number;
        wrap: 'balanced' | 'greedy';
        align: 'left' | 'center' | 'right';
        ls: number;
    };
    fonts: string[];
}

// ---------------------------------------------------------------------------
// Encode / decode
// ---------------------------------------------------------------------------

/** Chunked binary→string to avoid stack-overflow on large gzip buffers. */
function bytesToBinaryString(bytes: Uint8Array): string {
    const CHUNK = 0x8000;
    let out = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return out;
}

function encode(state: SharedState): string {
    const json = JSON.stringify(state);
    const gz = pako.gzip(json);
    const b64 = btoa(bytesToBinaryString(gz))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return b64;
}

function decode(hash: string): SharedState | null {
    if (!hash) return null;
    try {
        const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const bin = atob(padded);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const json = pako.ungzip(bytes, { to: 'string' });
        const parsed = JSON.parse(json);
        if (parsed?.v !== 1) return null;
        return parsed as SharedState;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Sync API
// ---------------------------------------------------------------------------

function snapshot(): SharedState {
    return {
        v: 1,
        doc: doc.pmJson,
        box: {
            w: box.width,
            h: box.height,
            wrap: box.wrap,
            align: box.align,
            ls: box.lineSpacing,
        },
        fonts: fonts.families(),
    };
}

let suppressPush = false;

/** Push current state to the URL hash via history.replaceState (no history spam). */
export function pushHash(): void {
    if (typeof window === 'undefined') return;
    if (suppressPush) return;
    const encoded = encode(snapshot());
    const next = '#' + encoded;
    if (window.location.hash === next) return; // identical — skip
    history.replaceState(null, '', next);
}

/** Build a shareable URL for the current state without modifying location. */
export function buildShareUrl(): string {
    if (typeof window === 'undefined') return '';
    const encoded = encode(snapshot());
    return `${window.location.origin}${window.location.pathname}#${encoded}`;
}

/** Read & apply hash state to the singletons. Safe to call multiple times. */
export async function applyHashFromUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const state = decode(raw);
    if (!state) return;

    suppressPush = true;
    try {
        box.width = state.box.w;
        box.height = state.box.h;
        box.wrap = state.box.wrap;
        box.align = state.box.align;
        box.lineSpacing = state.box.ls;
        doc.pmJson = state.doc;

        // Kick font loads in parallel — don't await, let the registry update
        // reactively as each resolves. Skip families already registered (Geist
        // from loadDefault, plus any user already added).
        const already = new Set(fonts.families());
        for (const family of state.fonts) {
            if (!already.has(family)) {
                void fonts.loadFamily(family);
            }
        }
    } finally {
        // Release on a microtask so the burst of writes above all coalesce
        // into a single suppressed effect tick before we re-enable pushing.
        queueMicrotask(() => {
            suppressPush = false;
        });
    }
}

// ---------------------------------------------------------------------------
// Reactive outbound sync (module scope)
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
    $effect.root(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        $effect(() => {
            // Track all serialized state. Touch the reactive surfaces so the
            // effect re-runs on any change. The read of fonts.families() taps
            // the entries-map reactivity (replaced wholesale in fonts.svelte.ts).
            void doc.pmJson;
            void box.width;
            void box.height;
            void box.wrap;
            void box.align;
            void box.lineSpacing;
            void fonts.families();

            if (timer) clearTimeout(timer);
            timer = setTimeout(pushHash, 500);
        });
        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    // Browser back/forward — re-apply whatever hash the user navigated to.
    window.addEventListener('hashchange', () => {
        void applyHashFromUrl();
    });
}
