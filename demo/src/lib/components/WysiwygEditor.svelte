<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { Editor } from 'svelte-tiptap';
    import { editorExtensions } from '$lib/editor/tiptap-extensions';
    import { doc } from '$lib/state/document.svelte';
    import EditorToolbar from './EditorToolbar.svelte';

    let editorEl: HTMLDivElement;
    let editor: Editor | null = $state(null);

    /** Non-reactive re-entrance lock. Set when we're pushing pmJson INTO the editor; */
    /** prevents the resulting onUpdate from looping back out. */
    let applying = false;

    onMount(() => {
        editor = new Editor({
            element: editorEl,
            extensions: editorExtensions,
            content: doc.pmJson,
            onUpdate: ({ editor }) => {
                if (applying) return;
                const next = editor.getJSON();
                if (JSON.stringify(next) === JSON.stringify(doc.pmJson)) return;
                doc.pmJson = next;
            },
        });
        return () => {
            editor?.destroy();
            editor = null;
        };
    });

    // Inbound: external changes to doc.pmJson → push into editor.
    // Use untrack so the inner code reading editor state doesn't re-trigger this effect.
    $effect(() => {
        if (!editor) return;
        const json = doc.pmJson;  // tracked dep
        untrack(() => {
            if (!editor) return;
            if (JSON.stringify(editor.getJSON()) === JSON.stringify(json)) return;
            applying = true;
            editor.commands.setContent(json, { emitUpdate: false });
            applying = false;
        });
    });
</script>

{#if editor}
    <EditorToolbar {editor} />
{/if}

<div class="wysiwyg" bind:this={editorEl}></div>

<style>
    .wysiwyg {
        background: light-dark(white, var(--color-surface-900));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        padding: 18px 18px 14px;
        font-family: 'Geist', sans-serif;
        font-size: 16px;
        line-height: 1.4;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        min-height: 142px;
    }
    .wysiwyg :global(.ProseMirror) { outline: none; }
    .wysiwyg :global(.ProseMirror p) { margin: 0 0 0.4em 0; }
    .wysiwyg :global(.ProseMirror p:last-child) { margin-bottom: 0; }
    .wysiwyg :global(.ProseMirror strong) { font-weight: 800; }
    .wysiwyg :global(.ProseMirror em) { font-style: italic; }
</style>
