// Shareable state encoded as gzip+base64url. The hash is *not* a continuous
// reflection of state — it only exists as the artifact of a deliberate share
// action. Three pieces:
//
//   - buildShareUrl():  called on Share-button click. Snapshots state, encodes,
//                       returns the full URL. Doesn't touch location.
//   - applyHashFromUrl(): called once at mount. If location.hash carries an
//                       encoded payload, restore the singletons from it AND
//                       clear the hash (so the URL goes back to clean once
//                       the user is editing).
//
// No reactive sync, no hashchange listener — the URL is "clean" except for
// the brief moment between landing on a shared link and the first paint.

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

function snapshot(): SharedState {
    // Union of registered fonts AND any fonts referenced by doc tokens. The
    // doc can carry a font reference (e.g. via the Tokens editor) without
    // the family ever being added to the inventory — without this, the
    // receiver wouldn't know to load it and the canvas would stay blank.
    const fontNames = new Set<string>(fonts.families());
    for (const tok of doc.tokens) {
        if (tok.font) fontNames.add(tok.font);
    }
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
        fonts: [...fontNames],
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build a shareable URL for the current state without modifying location. */
export function buildShareUrl(): string {
    if (typeof window === 'undefined') return '';
    const encoded = encode(snapshot());
    return `${window.location.origin}${window.location.pathname}#${encoded}`;
}

/**
 * Read state from `location.hash`, apply it to the singletons, then clear
 * the hash so the URL goes back to looking clean. No-op if hash is empty
 * or doesn't decode.
 */
export async function applyHashFromUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const state = decode(raw);

    // Always clear the hash once we've consumed (or attempted to consume) it,
    // so a stale/garbled hash doesn't linger in the URL bar either. Use the
    // raw History API rather than $app/navigation — SvelteKit's replaceState
    // requires the navigation context, and we're only stripping the hash, not
    // navigating. The warning about pushState/replaceState conflicts doesn't
    // apply for hash-only edits.
    if (window.location.hash) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(window.history.state, '', cleanUrl);
    }

    if (!state) return;

    box.width = state.box.w;
    box.height = state.box.h;
    box.wrap = state.box.wrap;
    box.align = state.box.align;
    box.lineSpacing = state.box.ls;
    doc.pmJson = state.doc;

    // Kick font loads in parallel — don't await, the registry updates reactively.
    const already = new Set(fonts.families());
    for (const family of state.fonts) {
        if (!already.has(family)) {
            void fonts.loadFamily(family);
        }
    }
}
