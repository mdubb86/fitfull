<script lang="ts">
    import type { Editor } from 'svelte-tiptap';
    import * as menu from '@zag-js/menu';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import ColorPickerButton from './ColorPickerButton.svelte';
    import FontPickerModal from './FontPickerModal.svelte';
    import { fonts } from '$lib/state/fonts.svelte';
    import { box } from '$lib/state/box.svelte';
    import { portalToBody } from '$lib/actions/portal';

    let { editor }: { editor: Editor } = $props();

    let pickerOpen = $state(false);

    // Snapshot of active marks/attributes, refreshed on every transaction.
    let snapshot = $state({
        bold: false,
        italic: false,
        color: '#000000',
        size: 1,
        fontFamily: null as string | null,
    });

    function refreshSnapshot() {
        snapshot = {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            // Fall back to the doc-level default text color when the current
            // selection has no per-token color set — so the swatch reflects
            // what the text will actually render as.
            color: editor.getAttributes('textStyle').color ?? box.textColor,
            size: editor.getAttributes('textStyle').size ?? 1,
            fontFamily: editor.getAttributes('textStyle').fontFamily ?? null,
        };
    }

    $effect(() => {
        refreshSnapshot();
        editor.on('selectionUpdate', refreshSnapshot);
        editor.on('transaction', refreshSnapshot);
        return () => {
            editor.off('selectionUpdate', refreshSnapshot);
            editor.off('transaction', refreshSnapshot);
        };
    });

    // The active font on the current selection — falls back to Geist (the
    // bundled default) when no fontFamily mark is set on the cursor.
    const activeFamily = $derived(snapshot.fontFamily ?? 'Geist');
    const supportsBold = $derived(fonts.supportsStyle(activeFamily, 'bold'));
    const supportsItalic = $derived(fonts.supportsStyle(activeFamily, 'italic'));

    function toggleBold() {
        editor.chain().focus().toggleBold().run();
    }
    function toggleItalic() {
        editor.chain().focus().toggleItalic().run();
    }
    function setColor(hex: string) {
        editor.chain().focus().setMark('textStyle', { color: hex }).run();
    }
    function clearFormatting() {
        editor.chain().focus().unsetMark('bold').unsetMark('italic').unsetMark('textStyle').run();
    }

    // Size stepper — value displayed in input as e.g. "1.0". On commit, clamp + apply.
    let sizeInput = $state('1.0');
    $effect(() => { sizeInput = formatSize(snapshot.size); });

    function formatSize(n: number): string {
        return n.toFixed(1);
    }
    function clampSize(n: number): number {
        if (!Number.isFinite(n)) return 1;
        return Math.min(10, Math.max(0.1, n));
    }
    function applySize(next: number) {
        const clamped = clampSize(next);
        const rounded = Math.round(clamped * 10) / 10;
        // Clearing back to 1.0 (default) → drop the size attribute to keep the mark clean.
        const payload = rounded === 1 ? { size: null } : { size: rounded };
        editor.chain().focus().setMark('textStyle', payload).run();
    }
    function stepUp() { applySize(snapshot.size + 0.1); }
    function stepDown() { applySize(snapshot.size - 0.1); }
    function commitSizeInput() {
        const parsed = parseFloat(sizeInput);
        if (Number.isNaN(parsed)) { sizeInput = formatSize(snapshot.size); return; }
        applySize(parsed);
    }
    function onSizeKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') { e.preventDefault(); commitSizeInput(); (e.target as HTMLInputElement).blur(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); stepUp(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); stepDown(); }
    }

    function applyFont(family: string) {
        editor.chain().focus().setMark('textStyle', { fontFamily: family }).run();
    }

    // Prevent toolbar buttons from stealing DOM focus on mousedown. Without
    // this, clicking the button blurs the editor, ProseMirror collapses the
    // selection, and the subsequent setMark only writes stored marks (which
    // don't appear in the document JSON). Result: input value updates but
    // doc tokens never change. Applied to every button that mutates the doc.
    function keepEditorFocus(e: MouseEvent) {
        e.preventDefault();
    }

    // Sentinel value for the "+ Add font…" menu item — anything not in fonts.families().
    const ADD_FONT_ITEM = '__add_font__';

    // Zag menu — dropdown of registered families plus the "+ Add font…" sentinel.
    const menuId = $props.id();
    const menuService = useMachine(menu.machine, () => ({
        id: menuId,
        positioning: { placement: 'bottom-start' as const, gutter: 4 },
        onSelect: (details: { value: string }) => {
            if (details.value === ADD_FONT_ITEM) {
                pickerOpen = true;
            } else {
                applyFont(details.value);
            }
        },
    }));
    const menuApi = $derived(menu.connect(menuService, normalizeProps));
</script>

<div class="toolbar">
    <div class="group">
        <button
            class="btn"
            class:on={snapshot.bold}
            disabled={!supportsBold}
            onclick={toggleBold}
            onmousedown={keepEditorFocus}
            title={supportsBold ? 'Bold' : `${activeFamily} doesn't have a bold variant`}
        ><b>B</b></button>
        <button
            class="btn"
            class:on={snapshot.italic}
            disabled={!supportsItalic}
            onclick={toggleItalic}
            onmousedown={keepEditorFocus}
            title={supportsItalic ? 'Italic' : `${activeFamily} doesn't have an italic variant`}
        ><i>I</i></button>
    </div>

    <span class="sep"></span>

    <div class="group font-group">
        <button {...menuApi.getTriggerProps()} class="btn font" title="Font family">
            <span class="font-label">{activeFamily}</span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
    </div>

    <span class="sep"></span>

    <div class="group">
        <ColorPickerButton color={snapshot.color} onChange={setColor} />
    </div>

    <span class="sep"></span>

    <div class="group size-group">
        <span class="size-label">Size</span>
        <div class="stepper">
            <input
                class="size-input"
                type="text"
                inputmode="decimal"
                value={sizeInput}
                oninput={(e) => sizeInput = (e.currentTarget as HTMLInputElement).value}
                onblur={commitSizeInput}
                onkeydown={onSizeKeydown}
                title="Size multiplier (0.1–10)"
            />
            <span class="size-x">×</span>
            <div class="stepper-buttons">
                <button class="step" onclick={stepUp} onmousedown={keepEditorFocus} title="Increase size" aria-label="Increase size">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 15 12 9 18 15"/></svg>
                </button>
                <button class="step" onclick={stepDown} onmousedown={keepEditorFocus} title="Decrease size" aria-label="Decrease size">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
        </div>
    </div>

    <span class="sep"></span>

    <div class="group">
        <button class="btn" onclick={clearFormatting} onmousedown={keepEditorFocus} title="Clear formatting">✕</button>
    </div>
</div>

<div use:portalToBody {...menuApi.getPositionerProps()} class="font-menu-positioner">
    <div {...menuApi.getContentProps()} class="font-menu-content">
        {#each fonts.families() as family (family)}
            <button
                {...menuApi.getItemProps({ value: family })}
                class="font-menu-item"
                class:active={family === activeFamily}
            >
                <span class="check">{family === activeFamily ? '✓' : ''}</span>
                <span class="name" style="font-family: '{family}', sans-serif;">{family}</span>
            </button>
        {/each}
        <div class="font-menu-sep"></div>
        <button
            {...menuApi.getItemProps({ value: ADD_FONT_ITEM })}
            class="font-menu-item add"
        >
            <span class="check"></span>
            <span class="name">+ Add font…</span>
        </button>
    </div>
</div>

<FontPickerModal bind:open={pickerOpen} onSelected={applyFont} />

<style>
    .toolbar {
        height: 36px;
        display: flex; align-items: center; gap: 2px;
        padding: 0 8px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .group {
        display: inline-flex; align-items: center; gap: 1px;
    }
    .sep {
        width: 1px; height: 18px;
        background: light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        margin: 0 4px;
    }

    .btn {
        height: 28px; min-width: 28px; padding: 0 8px;
        border: none; background: transparent;
        border-radius: 4px;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        font-size: 12px; font-weight: 500;
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        cursor: pointer;
    }
    .btn:not(.on):hover {
        background: light-dark(
            color-mix(in oklab, black 8%, transparent),
            color-mix(in oklab, white 10%, transparent)
        );
        color: light-dark(var(--color-surface-950), white);
    }
    .btn.on {
        background: light-dark(var(--color-surface-200), var(--color-surface-700));
        color: light-dark(var(--color-surface-950), white);
    }
    .btn.on:hover {
        background: light-dark(var(--color-surface-300), var(--color-surface-500));
    }
    .btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .btn:disabled:hover { background: transparent; }

    /* Font group absorbs all leftover horizontal space; the button stretches to fill it. */
    .font-group { flex: 1; min-width: 0; }
    .btn.font {
        width: 100%;
        justify-content: space-between;
    }
    .font-label {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0; flex: 1; text-align: left;
    }

    /* Zag emits inline z-index: var(--z-index); raise above the WYSIWYG layer. */
    .font-menu-positioner { --z-index: 1000; }
    .font-menu-content {
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        border-radius: 6px;
        padding: 4px;
        min-width: 180px;
        display: flex; flex-direction: column;
        box-shadow: 0 10px 30px -8px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.25);
        outline: none;
    }
    .font-menu-item {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px;
        background: transparent;
        border: none; border-radius: 4px;
        text-align: left;
        cursor: pointer;
        color: light-dark(var(--color-surface-800), var(--color-surface-100));
        font-size: 13px;
    }
    .font-menu-item[data-highlighted],
    .font-menu-item:hover {
        background: light-dark(var(--color-surface-200), color-mix(in oklab, white 10%, transparent));
        color: light-dark(var(--color-surface-950), white);
        outline: none;
    }
    .font-menu-item .check {
        display: inline-block;
        width: 14px;
        color: var(--color-brand);
        font-size: 12px;
        text-align: center;
        flex-shrink: 0;
    }
    .font-menu-item .name {
        flex: 1;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .font-menu-item.add .name {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        font-style: italic;
    }
    .font-menu-sep {
        height: 1px;
        margin: 4px 4px;
        background: light-dark(var(--color-surface-200), color-mix(in oklab, white 10%, transparent));
    }

    .size-group {
        gap: 6px;
        padding: 0 4px;
    }
    .size-label {
        font-size: 11px; font-weight: 500;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
    .stepper {
        display: inline-flex; align-items: center;
        height: 24px;
        background: light-dark(white, color-mix(in oklab, white 5%, transparent));
        border: 1px solid light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        border-radius: 4px;
        padding: 0 4px;
    }
    .stepper:focus-within {
        outline: 1px solid var(--color-primary-500);
    }
    .size-input {
        width: 32px; height: 100%;
        border: none; background: transparent;
        padding: 0; margin: 0;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        font: 11px var(--font-mono, 'Geist Mono', ui-monospace, monospace);
        text-align: right;
        outline: none;
    }
    .size-x {
        font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        margin: 0 2px 0 1px;
    }
    .stepper-buttons {
        display: inline-flex; flex-direction: column;
        height: 100%;
        margin-left: 2px;
    }
    .step {
        flex: 1; height: 50%;
        width: 14px;
        padding: 0; border: none;
        background: transparent;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 2px;
    }
    .step:hover {
        color: var(--color-primary-500);
        background: light-dark(var(--color-surface-100), color-mix(in oklab, white 8%, transparent));
    }
</style>
