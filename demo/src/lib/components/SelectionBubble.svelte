<script lang="ts">
    import { BubbleMenu, Editor } from 'svelte-tiptap';

    let { editor }: { editor: Editor } = $props();

    function toggleBold() {
        editor.chain().focus().toggleBold().run();
    }
    function toggleItalic() {
        editor.chain().focus().toggleItalic().run();
    }
    function toggleEmphasis() {
        // Cycle the textStyle.size attribute on the current selection between 1 and 2.
        const current = editor.getAttributes('textStyle').size;
        const next = current === 2 ? null : 2;
        editor.chain().focus().setMark('textStyle', { size: next }).run();
    }
    function clearFormatting() {
        editor.chain().focus().unsetMark('bold').unsetMark('italic').unsetMark('textStyle').run();
    }

    // Phase 5 stubs:
    function openFontPicker() {
        // TODO: Phase 5 — open the Google Fonts picker modal.
        console.log('[Phase 5] font picker not wired yet');
    }
    function openColorPicker() {
        // TODO: Phase 5 — open color picker (or use a swatch grid).
        console.log('[Phase 5] color picker not wired yet');
    }
</script>

<BubbleMenu {editor}>
    <div class="bubble">
        <button class:on={editor.isActive('bold')} onclick={toggleBold} title="Bold"><b>B</b></button>
        <button class:on={editor.isActive('italic')} onclick={toggleItalic} title="Italic"><i>I</i></button>
        <span class="sep"></span>
        <button onclick={openFontPicker} title="Font family">
            Font
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button onclick={openColorPicker} title="Color">
            <span class="swatch" style="background: var(--color-brand)"></span>
        </button>
        <span class="sep"></span>
        <button class:on={editor.getAttributes('textStyle').size === 2} onclick={toggleEmphasis} title="Emphasis 1× / 2×">2×</button>
        <button onclick={clearFormatting} title="Clear formatting">✕</button>
    </div>
</BubbleMenu>

<style>
    .bubble {
        background: light-dark(var(--color-surface-950), var(--color-surface-800));
        color: light-dark(var(--color-surface-50), var(--color-surface-50));
        border-radius: 0.375rem;
        padding: 4px;
        display: flex; align-items: center; gap: 2px;
        box-shadow: 0 8px 24px -8px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
    }
    .bubble button {
        height: 28px; min-width: 28px; padding: 0 8px;
        border: none; background: transparent;
        border-radius: 4px;
        color: light-dark(var(--color-surface-300), var(--color-surface-300));
        font-size: 12px; font-weight: 500;
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        cursor: pointer;
    }
    .bubble button:hover {
        background: color-mix(in oklab, white 10%, transparent);
        color: white;
    }
    .bubble button.on {
        color: var(--color-primary-500);
    }
    .bubble .sep {
        width: 1px; height: 18px;
        background: color-mix(in oklab, white 12%, transparent);
        margin: 0 2px;
    }
    .bubble .swatch {
        width: 16px; height: 16px;
        border-radius: 3px;
        border: 1px solid color-mix(in oklab, white 18%, transparent);
        display: inline-block;
    }
</style>
