<script lang="ts">
    import type { Shadow } from 'fitfull/browser';
    import { box } from '$lib/state/box.svelte';
    import ColorPickerButton from './ColorPickerButton.svelte';

    const HARD: Shadow = { offsetX: 0.05, offsetY: 0.05, blur: 0, color: 'rgba(0,0,0,0.5)' };
    const SOFT: Shadow = { offsetX: 0.03, offsetY: 0.04, blur: 0.025, color: 'rgba(0,0,0,0.45)' };

    let enabled = $derived(box.shadow !== null);

    const uid = $props.id();
    const offsetXId = `${uid}-offset-x`;
    const offsetYId = `${uid}-offset-y`;
    const blurId = `${uid}-blur`;

    function toggle(on: boolean) {
        if (on) {
            box.setShadow(HARD);
        } else {
            box.setShadow(null);
        }
    }

    function setPreset(preset: Shadow) {
        box.setShadow({ ...preset });
    }

    function setOffsetX(v: number) { box.patchShadow({ offsetX: v }); }
    function setOffsetY(v: number) { box.patchShadow({ offsetY: v }); }
    function setBlur(v: number)    { box.patchShadow({ blur: v }); }
    function setColor(c: string)   { box.patchShadow({ color: c }); }
</script>

<section class="shadow-section">
    <header class="shadow-hdr">
        <span class="lbl">Shadow</span>
        <label class="toggle">
            <input type="checkbox" checked={enabled} onchange={(e) => toggle((e.currentTarget as HTMLInputElement).checked)} />
            <span>{enabled ? 'On' : 'Off'}</span>
        </label>
    </header>

    {#if enabled && box.shadow}
        <div class="presets">
            <button class="preset" onclick={() => setPreset(HARD)}>Hard</button>
            <button class="preset" onclick={() => setPreset(SOFT)}>Soft</button>
        </div>

        <div class="field">
            <label class="key" for={offsetXId}>Offset X</label>
            <input
                id={offsetXId}
                type="range" min="-0.2" max="0.2" step="0.005"
                value={box.shadow.offsetX}
                oninput={(e) => setOffsetX(parseFloat((e.currentTarget as HTMLInputElement).value))}
            />
            <span class="val">{box.shadow.offsetX.toFixed(3)}em</span>
        </div>

        <div class="field">
            <label class="key" for={offsetYId}>Offset Y</label>
            <input
                id={offsetYId}
                type="range" min="-0.2" max="0.2" step="0.005"
                value={box.shadow.offsetY}
                oninput={(e) => setOffsetY(parseFloat((e.currentTarget as HTMLInputElement).value))}
            />
            <span class="val">{box.shadow.offsetY.toFixed(3)}em</span>
        </div>

        <div class="field">
            <label class="key" for={blurId}>Blur</label>
            <input
                id={blurId}
                type="range" min="0" max="0.15" step="0.005"
                value={box.shadow.blur ?? 0}
                oninput={(e) => setBlur(parseFloat((e.currentTarget as HTMLInputElement).value))}
            />
            <span class="val">{(box.shadow.blur ?? 0).toFixed(3)}em</span>
        </div>

        <div class="field color-field">
            <span class="key">Color</span>
            <ColorPickerButton
                block
                color={box.shadow.color ?? 'rgba(0,0,0,0.5)'}
                onChange={setColor}
                label="Shadow color"
            />
        </div>
    {/if}
</section>

<style>
    .shadow-section {
        display: flex; flex-direction: column; gap: 0.5rem;
        padding: 0.75rem 0;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .shadow-hdr { display: flex; justify-content: space-between; align-items: center; }
    .lbl { font-weight: 600; }
    .toggle { display: inline-flex; gap: 0.35rem; align-items: center; cursor: pointer; }
    .presets { display: flex; gap: 0.35rem; }
    .preset {
        padding: 0.25rem 0.5rem;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-600), var(--color-surface-300));
        border-radius: 4px;
        cursor: pointer;
    }
    .preset:hover {
        color: var(--color-brand);
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .field { display: grid; grid-template-columns: 5rem 1fr auto; gap: 0.5rem; align-items: center; }
    .key { font-size: 0.85em; color: light-dark(var(--color-surface-700), var(--color-surface-300)); }
    .val { font-variant-numeric: tabular-nums; font-size: 0.85em; }
    .color-field { grid-template-columns: 5rem 1fr; }
</style>
