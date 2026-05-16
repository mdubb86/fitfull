<script lang="ts">
    import type { Editor } from 'svelte-tiptap';
    import ColorPickerButton from './ColorPickerButton.svelte';

    let { editor }: { editor: Editor } = $props();

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
            color: editor.getAttributes('textStyle').color ?? '#000000',
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

    // Font stub — Phase 5.
    function openFontPicker() {
        console.log('[Phase 5] font picker not wired yet');
    }
</script>

<div class="toolbar">
    <div class="group">
        <button class="btn" class:on={snapshot.bold} onclick={toggleBold} title="Bold"><b>B</b></button>
        <button class="btn" class:on={snapshot.italic} onclick={toggleItalic} title="Italic"><i>I</i></button>
    </div>

    <span class="sep"></span>

    <div class="group">
        <button class="btn font" onclick={openFontPicker} title="Font family (Phase 5)">
            <span class="font-label">{snapshot.fontFamily ?? 'Font'}</span>
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
                <button class="step" onclick={stepUp} title="Increase size" aria-label="Increase size">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 15 12 9 18 15"/></svg>
                </button>
                <button class="step" onclick={stepDown} title="Decrease size" aria-label="Decrease size">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
        </div>
    </div>

    <span class="sep"></span>

    <div class="group">
        <button class="btn" onclick={clearFormatting} title="Clear formatting">✕</button>
    </div>
</div>

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
    .btn:hover {
        background: light-dark(
            color-mix(in oklab, black 8%, transparent),
            color-mix(in oklab, white 10%, transparent)
        );
        color: light-dark(var(--color-surface-950), white);
    }
    .btn.on {
        color: var(--color-primary-500);
    }

    .btn.font {
        max-width: 140px;
    }
    .font-label {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 110px;
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
