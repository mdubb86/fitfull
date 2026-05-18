import { pmJsonToTokens, tokensToPmJson } from '$lib/tokens/mapping';
import type { Token } from 'fitfull';

// Starter doc — shows off mixed fonts + size emphasis right on first load.
// "type" is Playfair Display italic (serif contrast against Geist sans).
// "fits." is bold + 1.5× to demonstrate per-run size scaling.
const DEFAULT_DOC = {
    type: 'doc',
    content: [{
        type: 'paragraph',
        content: [
            { type: 'text', text: 'Ship ' },
            {
                type: 'text',
                text: 'type',
                marks: [
                    { type: 'italic' },
                    { type: 'textStyle', attrs: { fontFamily: 'Playfair Display' } },
                ],
            },
            { type: 'text', text: ' that ' },
            {
                type: 'text',
                text: 'fits.',
                marks: [
                    { type: 'bold' },
                    { type: 'textStyle', attrs: { size: 1.5, color: '#bedf1b' } },
                ],
            },
        ],
    }],
};

/**
 * Module-singleton: import { doc } from '$lib/state/document.svelte' anywhere.
 *
 * The ProseMirror document JSON is the authoritative source. The TipTap WYSIWYG
 * editor (Phase 4 dispatch 2) binds bidirectionally to `doc.pmJson`. The CodeMirror
 * Tokens editor (Phase 4 dispatch 3) derives a JSON view via `doc.tokens` and writes
 * back via `doc.setTokens(...)`.
 *
 * Mapping between pmJson and tokens is lossless under the constrained TipTap mark
 * set (bold/italic/textStyle{font,color,size}). See docs/superpowers/research/
 * 2026-05-16-tiptap-svelte.md for the algorithm + the deliberate one-way-lossy
 * color caveat.
 */
class DocumentState {
    /** Authoritative ProseMirror document JSON. Bound to TipTap. */
    pmJson = $state<any>(DEFAULT_DOC);

    /** Derived view: fitfull tokens array. Bound to CodeMirror. */
    get tokens(): Token[] {
        return pmJsonToTokens(this.pmJson);
    }

    /** Apply an incoming tokens edit (from CodeMirror) back to pmJson. */
    setTokens(tokens: Token[]) {
        this.pmJson = tokensToPmJson(tokens);
    }
}

export const doc = new DocumentState();
