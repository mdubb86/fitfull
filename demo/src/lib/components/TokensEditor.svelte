<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { EditorState } from '@codemirror/state';
    import { EditorView, type ViewUpdate } from '@codemirror/view';
    import { tokensEditorExtensions } from '$lib/editor/codemirror-setup';
    import { doc } from '$lib/state/document.svelte';
    import type { Token } from 'fitfull';

    let editorEl: HTMLDivElement;
    let view: EditorView | null = $state(null);

    /** Re-entrance lock for inbound updates (doc.tokens → editor). */
    let applying = false;

    onMount(() => {
        const initial = JSON.stringify(doc.tokens, null, 2);
        const state = EditorState.create({
            doc: initial,
            extensions: [
                ...tokensEditorExtensions(),
                EditorView.updateListener.of((u: ViewUpdate) => {
                    if (applying) return;
                    if (!u.docChanged) return;
                    const text = u.state.doc.toString();
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(text);
                    } catch {
                        return;  // invalid JSON — leave doc.tokens alone; linter flags it
                    }
                    if (!Array.isArray(parsed)) return;
                    // Skip if structurally identical to current doc.tokens.
                    if (JSON.stringify(parsed) === JSON.stringify(doc.tokens)) return;
                    doc.setTokens(parsed as Token[]);
                }),
            ],
        });
        view = new EditorView({ state, parent: editorEl });
        return () => {
            view?.destroy();
            view = null;
        };
    });

    // Inbound: external doc.tokens change → push into editor (skip if string matches).
    $effect(() => {
        if (!view) return;
        const tokens = doc.tokens;  // tracked dep
        untrack(() => {
            if (!view) return;
            const next = JSON.stringify(tokens, null, 2);
            const current = view.state.doc.toString();
            if (current === next) return;
            applying = true;
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: next },
            });
            applying = false;
        });
    });
</script>

<div class="tokens-editor" bind:this={editorEl}></div>

<style>
    .tokens-editor {
        background: light-dark(white, var(--color-surface-900));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        font-family: 'Geist Mono', monospace;
        font-size: 12px;
        min-height: 200px;
    }
    .tokens-editor :global(.cm-editor) {
        font-family: 'Geist Mono', monospace;
        font-size: 12px;
        background: transparent;
    }
    .tokens-editor :global(.cm-editor.cm-focused) {
        outline: none;
    }
    .tokens-editor :global(.cm-gutters) {
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        color: light-dark(var(--color-surface-400), var(--color-surface-600));
        border-right: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .tokens-editor :global(.cm-content) {
        padding: 12px 8px;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        caret-color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .tokens-editor :global(.cm-activeLine) {
        background: light-dark(var(--color-surface-100), color-mix(in oklab, var(--color-surface-800) 40%, transparent));
    }
    .tokens-editor :global(.cm-activeLineGutter) {
        background: light-dark(var(--color-surface-100), color-mix(in oklab, var(--color-surface-800) 60%, transparent));
    }
    .tokens-editor :global(.cm-lintRange-error) {
        background: linear-gradient(to bottom, transparent 60%, color-mix(in oklab, var(--color-error-500) 40%, transparent) 60%);
    }
</style>
