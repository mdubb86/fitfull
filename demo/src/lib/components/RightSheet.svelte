<script lang="ts">
    import { box } from '$lib/state/box.svelte';
    import { fit } from '$lib/fitfull/fit.svelte';
    import { ui } from '$lib/state/ui.svelte';
    import ColorPickerButton from './ColorPickerButton.svelte';

    function onDimInput() {
        // bind:value already updated box.width/box.height; trigger a debounced fit.
        fit.scheduleFit(180);
    }

    function setWrap(w: 'balanced' | 'greedy') {
        box.wrap = w;
        fit.scheduleFit(0);
    }
    function setAlign(a: 'left' | 'center' | 'right') {
        box.align = a;
        fit.scheduleFit(0);
    }
    function onSpacingChange() {
        fit.scheduleFit(0);
    }

    function setTextColor(hex: string) { box.textColor = hex; }
    function resetTextColor()           { box.textColor = '#000000'; }
    function setBgColor(hex: string)   { box.bgColor = hex; }
    function resetBgColor()             { box.bgColor = null; }
</script>

<aside class="sheet sheet-right" class:collapsed={ui.rightCollapsed}>
    <div class="sheet-head">
        <span class="sheet-title">Settings</span>
        <button class="sheet-toggle" onclick={() => ui.setRightCollapsed(true)} title="Hide settings sheet" aria-label="Hide settings sheet">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="5.5 3 9.5 7 5.5 11"/>
            </svg>
        </button>
    </div>
    <div class="sheet-body">
        <!-- Dimensions -->
        <div class="section">
            <div class="section-head">
                <span class="name">
                    <span class="dot"></span>
                    Dimensions
                </span>
                <span class="val">{box.width} × {box.height}</span>
            </div>
            <div class="section-body">
                <div class="numpair">
                    <label class="numinput">
                        <span class="lbl-mini">W</span>
                        <input type="number" bind:value={box.width} oninput={onDimInput} />
                        <span class="suffix">px</span>
                    </label>
                    <label class="numinput">
                        <span class="lbl-mini">H</span>
                        <input type="number" bind:value={box.height} oninput={onDimInput} />
                        <span class="suffix">px</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Layout -->
        <div class="section">
            <div class="section-head">
                <span class="name">
                    <span class="dot"></span>
                    Layout
                </span>
            </div>
            <div class="section-body">
                <div class="field">
                    <div class="field-head">
                        <span class="lbl">Wrap mode</span>
                        <span class="val">{box.wrap}</span>
                    </div>
                    <div class="minigroup">
                        <button class:active={box.wrap === 'balanced'} onclick={() => setWrap('balanced')}>Balanced</button>
                        <button class:active={box.wrap === 'greedy'} onclick={() => setWrap('greedy')}>Greedy</button>
                    </div>
                </div>
                <div class="field">
                    <div class="field-head">
                        <span class="lbl">Align</span>
                        <span class="val">{box.align}</span>
                    </div>
                    <div class="aligns">
                        {#each ['left', 'center', 'right'] as const as a}
                            <button class:active={box.align === a} onclick={() => setAlign(a)} title={a}>
                                {#if a === 'left'}
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="2" y1="7" x2="9" y2="7"/><line x1="2" y1="10.5" x2="11" y2="10.5"/></svg>
                                {:else if a === 'center'}
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="3" y1="10.5" x2="11" y2="10.5"/></svg>
                                {:else}
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="5" y1="7" x2="12" y2="7"/><line x1="3" y1="10.5" x2="12" y2="10.5"/></svg>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>
                <div class="field">
                    <div class="field-head">
                        <span class="lbl">Line spacing</span>
                        <span class="val">{box.lineSpacing.toFixed(1)}×</span>
                    </div>
                    <input class="slider" type="range" min="0.8" max="1.5" step="0.05" bind:value={box.lineSpacing} onchange={onSpacingChange} />
                </div>
            </div>
        </div>

        <!-- Colors -->
        <div class="section">
            <div class="section-head">
                <span class="name">
                    <span class="dot"></span>
                    Colors
                </span>
            </div>
            <div class="section-body">
                <div class="field color-field">
                    <div class="field-head">
                        <span class="lbl">Text default</span>
                        {#if box.textColor.toLowerCase() !== '#000000'}
                            <button class="reset-color" onclick={resetTextColor} title="Reset to black">✕</button>
                        {/if}
                    </div>
                    <ColorPickerButton color={box.textColor} onChange={setTextColor} />
                </div>
                <div class="field color-field">
                    <div class="field-head">
                        <span class="lbl">Background</span>
                        {#if box.bgColor}
                            <button class="reset-color" onclick={resetBgColor} title="Reset to transparent">✕</button>
                        {:else}
                            <span class="val">transparent</span>
                        {/if}
                    </div>
                    <ColorPickerButton color={box.bgColor ?? '#ffffff'} onChange={setBgColor} />
                </div>
            </div>
        </div>
    </div>
</aside>

<style>
    .sheet {
        width: 320px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-left: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        min-height: 0; min-width: 0; overflow: hidden;
        transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sheet.collapsed { width: 0; border: none; }
    /* Mobile: fixed-position modal overlay (see LeftSheet for rationale). */
    @media (max-width: 1023px) {
        .sheet {
            position: fixed;
            top: 48px;
            left: 0; right: 0; bottom: 0;
            width: auto;
            z-index: 50;
        }
        .sheet.collapsed { display: none; }
    }
    .sheet-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 16px;
        height: 48px;
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .sheet-title {
        font-size: 10.5px; font-weight: 600;
        letter-spacing: 0.14em; text-transform: uppercase;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .sheet-toggle {
        width: 30px; height: 28px;
        display: grid; place-items: center;
        border-radius: 6px;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-600), var(--color-surface-300));
        cursor: pointer;
        transition: background 120ms, border-color 120ms, color 120ms;
    }
    .sheet-toggle:hover {
        color: var(--color-brand);
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
    }
    .sheet-toggle:active {
        background: light-dark(var(--color-surface-300), var(--color-surface-700));
    }
    .sheet-toggle:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-brand) 30%, transparent);
    }
    .sheet-body { overflow-y: auto; min-height: 0; }
    .section { border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800)); }
    .section-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px;
    }
    .section-head .val {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .section-head .name {
        font-size: 12px; font-weight: 500;
        display: flex; align-items: center; gap: 8px;
    }
    .section-head .dot {
        width: 4px; height: 4px; border-radius: 999px;
        background: var(--color-brand); opacity: 0.7;
    }
    .section-body { padding: 4px 14px 14px; }
    .numpair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .numinput {
        position: relative;
        background: light-dark(white, var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 0.375rem;
        padding: 6px 28px 6px 10px;
        display: flex; align-items: center;
    }
    .numinput input {
        width: 100%; font-family: 'Geist Mono', monospace;
        font-size: 12.5px; outline: none; background: transparent;
        border: none; color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .numinput .suffix {
        position: absolute; right: 10px;
        font-family: 'Geist Mono', monospace; font-size: 10.5px;
        color: light-dark(var(--color-surface-400), var(--color-surface-500));
    }
    .numinput .lbl-mini {
        position: absolute; left: 8px; top: -6px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        padding: 0 4px;
        font-family: 'Geist Mono', monospace; font-size: 9.5px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        letter-spacing: 0.04em; text-transform: uppercase;
    }
    .numinput:focus-within {
        border-color: var(--color-brand);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-brand) 18%, transparent);
    }
    .field { padding: 8px 0; }
    .field-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 6px;
    }
    .field .lbl {
        font-size: 11px;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
    .field .val {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .minigroup, .aligns {
        display: flex; gap: 4px;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 0.375rem;
        padding: 2px;
    }
    .aligns { display: grid; grid-template-columns: repeat(3, 1fr); }
    .minigroup button, .aligns button {
        font-size: 11px; font-weight: 500;
        color: light-dark(var(--color-surface-600), var(--color-surface-300));
        padding: 5px 8px; border-radius: 4px;
        border: none; background: transparent; cursor: pointer;
        display: inline-flex; justify-content: center; align-items: center; gap: 4px;
    }
    .minigroup button { flex: 1; }
    .aligns button { height: 26px; }
    .minigroup button:hover, .aligns button:hover {
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .minigroup button.active, .aligns button.active {
        background: light-dark(white, var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        box-shadow: inset 0 0 0 1px light-dark(var(--color-surface-200), var(--color-surface-700));
    }
    .aligns button.active { color: var(--color-brand); }
    .slider {
        width: 100%;
        accent-color: var(--color-brand);
    }
    .color-field .field-head { margin-bottom: 6px; }
    .reset-color {
        width: 18px; height: 18px;
        padding: 0; border: none; background: transparent;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        font-size: 10px; cursor: pointer;
        border-radius: 3px;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .reset-color:hover {
        color: light-dark(var(--color-surface-950), white);
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
    }
</style>
