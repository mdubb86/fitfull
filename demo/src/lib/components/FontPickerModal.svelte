<script lang="ts">
    import * as dialog from '@zag-js/dialog';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import { fonts } from '$lib/state/fonts.svelte';
    import { getCatalog, type FontFamily } from '$lib/fonts/catalog';
    import { portalToBody } from '$lib/actions/portal';
    import type { FontWeight } from 'fitfull';

    type Props = {
        open: boolean;
        onSelected?: (family: string) => void;
    };
    let { open = $bindable(false), onSelected }: Props = $props();

    // Curated featured list — mix of categories, ~30 popular families.
    const FEATURED: string[] = [
        // Sans-serif
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Montserrat',
        'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Outfit',
        // Serif
        'Playfair Display', 'Merriweather', 'Lora', 'EB Garamond',
        'Crimson Pro', 'Source Serif 4', 'DM Serif Display',
        // Display
        'Bebas Neue', 'Oswald', 'Archivo Black', 'Anton',
        // Monospace
        'JetBrains Mono', 'Fira Code', 'Space Mono', 'IBM Plex Mono',
        // Handwriting / script
        'Caveat', 'Dancing Script', 'Pacifico',
        // Modern sans
        'Space Grotesk',
    ];

    // Catalog is loaded eagerly from the virtual module (sync) — see catalog.ts.
    const catalog: FontFamily[] = getCatalog();
    const catalogByName: Map<string, FontFamily> = new Map(catalog.map((f) => [f.family, f]));

    let tab = $state<'featured' | 'browse'>('featured');
    let search = $state('');
    let selectedFamily = $state<string | null>(null);
    // Bitfield-ish selection set — using a fresh Set on every mutation to trigger reactivity.
    let selectedWeights = $state<Set<FontWeight>>(new Set(['regular']));
    let busy = $state(false);

    const id = $props.id();
    const service = useMachine(dialog.machine, () => ({
        id,
        // Controlled — drive open from the prop and propagate user-initiated
        // closes back via onOpenChange (clicks outside, ESC, close button).
        open,
        onOpenChange: (details: dialog.OpenChangeDetails) => {
            open = details.open;
            if (!details.open) {
                // Reset transient picker state when the modal closes so the
                // next open starts on the Featured tab with no family selected.
                resetPickerState();
            }
        },
    }));
    const api = $derived(dialog.connect(service, normalizeProps));

    function resetPickerState() {
        tab = 'featured';
        search = '';
        selectedFamily = null;
        selectedWeights = new Set(['regular']);
        busy = false;
    }

    // Featured cards built from the catalog where possible (so we know their
    // available weights). If a featured family isn't in the catalog it still
    // renders — selecting it falls back to a regular-only weight panel.
    const featuredFamilies = $derived(
        FEATURED.map((name) => catalogByName.get(name) ?? ({ family: name, category: 'sans-serif', variants: [400] } as FontFamily)),
    );

    // Browse filter — case-insensitive substring match on family name.
    // Catalog has ~1900 entries; rendering them all is fine in plain DOM
    // (each row is just a button) but the filter happens client-side here.
    const browseResults = $derived.by(() => {
        const q = search.trim().toLowerCase();
        if (!q) return catalog;
        return catalog.filter((f) => f.family.toLowerCase().includes(q));
    });

    function selectFamily(family: string) {
        selectedFamily = family;
        // Reset weight selection to a sensible default (Regular checked if available).
        const entry = catalogByName.get(family);
        const has400 = !entry || entry.variants.includes(400);
        selectedWeights = new Set(has400 ? ['regular'] : []);
    }

    function toggleWeight(w: FontWeight) {
        const next = new Set(selectedWeights);
        if (next.has(w)) next.delete(w);
        else next.add(w);
        selectedWeights = next;
    }

    // Available weight options for the selected family. We expose only the
    // 400/700 buckets per the strict-mapping decision (research §5 option A),
    // plus their italic variants if the family offers them.
    type WeightOption = { weight: FontWeight; numeric: 400 | 700; italic: boolean; label: string };
    const weightOptions = $derived.by<WeightOption[]>(() => {
        if (!selectedFamily) return [];
        const entry = catalogByName.get(selectedFamily);
        // Default-permissive when the family isn't in the catalog: assume 400 normal exists.
        const variants = entry?.variants ?? [400];
        const italicVariants = entry?.italicVariants ?? [];
        const out: WeightOption[] = [];
        if (variants.includes(400)) out.push({ weight: 'regular', numeric: 400, italic: false, label: 'Regular 400' });
        if (variants.includes(700)) out.push({ weight: 'bold', numeric: 700, italic: false, label: 'Bold 700' });
        if (italicVariants.includes(400)) out.push({ weight: 'italic', numeric: 400, italic: true, label: 'Italic 400i' });
        if (italicVariants.includes(700)) out.push({ weight: 'bolditalic', numeric: 700, italic: true, label: 'Bold Italic 700i' });
        return out;
    });

    async function addToProject() {
        if (!selectedFamily || selectedWeights.size === 0 || busy) return;
        busy = true;
        const family = selectedFamily;
        const weights = [...selectedWeights];
        try {
            // Kick off all weight loads in parallel — addFont is independently idempotent per (family, weight).
            await Promise.all(weights.map((w) => fonts.addFont(family, w)));
            onSelected?.(family);
        } finally {
            busy = false;
            // Closing also resets state via onOpenChange.
            open = false;
        }
    }

    function cancel() {
        open = false;
    }
</script>

<div use:portalToBody {...api.getBackdropProps()} class="fp-backdrop"></div>
<div use:portalToBody {...api.getPositionerProps()} class="fp-positioner">
    <div {...api.getContentProps()} class="fp-content font-picker-modal">
        <header class="fp-header">
            <h2 {...api.getTitleProps()} class="fp-title">Add a font</h2>
            <button {...api.getCloseTriggerProps()} class="fp-close" aria-label="Close">✕</button>
        </header>

        <div class="fp-tabs" role="tablist">
            <button
                class="fp-tab"
                class:on={tab === 'featured'}
                role="tab"
                aria-selected={tab === 'featured'}
                onclick={() => { tab = 'featured'; }}
            >Featured</button>
            <button
                class="fp-tab"
                class:on={tab === 'browse'}
                role="tab"
                aria-selected={tab === 'browse'}
                onclick={() => { tab = 'browse'; }}
            >Browse all ({catalog.length})</button>
        </div>

        <div class="fp-body">
            {#if tab === 'featured'}
                <div class="fp-grid">
                    {#each featuredFamilies as ff (ff.family)}
                        <button
                            class="fp-card"
                            class:selected={selectedFamily === ff.family}
                            onclick={() => selectFamily(ff.family)}
                            type="button"
                        >
                            <span class="fp-card-name" style="font-family: '{ff.family}', sans-serif;">{ff.family}</span>
                            <span class="fp-card-meta">{ff.category}</span>
                        </button>
                    {/each}
                </div>
            {:else}
                <input
                    class="fp-search"
                    type="search"
                    placeholder="Search {catalog.length} families…"
                    bind:value={search}
                    autocomplete="off"
                />
                <div class="fp-list">
                    {#each browseResults.slice(0, 200) as ff (ff.family)}
                        <button
                            class="fp-list-row"
                            class:selected={selectedFamily === ff.family}
                            onclick={() => selectFamily(ff.family)}
                            type="button"
                        >
                            <span class="fp-list-name">{ff.family}</span>
                            <span class="fp-list-meta">{ff.category} · {ff.variants.length} wt</span>
                        </button>
                    {/each}
                    {#if browseResults.length > 200}
                        <p class="fp-list-overflow">Showing first 200 of {browseResults.length} — refine your search.</p>
                    {/if}
                    {#if browseResults.length === 0}
                        <p class="fp-list-overflow">No families match “{search}”.</p>
                    {/if}
                </div>
            {/if}
        </div>

        {#if selectedFamily}
            <div class="fp-weight-panel">
                <div class="fp-weight-head">
                    <span class="fp-weight-label">Selected:</span>
                    <span class="fp-weight-family" style="font-family: '{selectedFamily}', sans-serif;">{selectedFamily}</span>
                </div>
                <div class="fp-weight-chips">
                    {#if weightOptions.length === 0}
                        <span class="fp-weight-empty">No 400/700 weights available for this family.</span>
                    {:else}
                        {#each weightOptions as opt (opt.weight)}
                            <label class="fp-weight-chip" class:on={selectedWeights.has(opt.weight)}>
                                <input
                                    type="checkbox"
                                    checked={selectedWeights.has(opt.weight)}
                                    onchange={() => toggleWeight(opt.weight)}
                                />
                                <span>{opt.label}</span>
                            </label>
                        {/each}
                    {/if}
                </div>
            </div>
        {/if}

        <footer class="fp-footer">
            <button class="fp-btn ghost" onclick={cancel} type="button">Cancel</button>
            <button
                class="fp-btn primary"
                onclick={addToProject}
                disabled={!selectedFamily || selectedWeights.size === 0 || busy}
                type="button"
            >{busy ? 'Adding…' : 'Add to project'}</button>
        </footer>
    </div>
</div>

<style>
    /* Zag emits inline z-index: var(--z-index); default to a value above the WYSIWYG overlays. */
    .fp-backdrop {
        --z-index: 1000;
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(2px);
    }
    .fp-positioner {
        --z-index: 1001;
        position: fixed; inset: 0;
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        pointer-events: none;
    }
    .fp-content {
        pointer-events: auto;
        width: min(720px, 100%);
        max-height: min(720px, calc(100vh - 48px));
        display: flex; flex-direction: column;
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 8px;
        box-shadow: 0 24px 60px -12px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3);
        overflow: hidden;
    }

    .fp-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .fp-title {
        margin: 0;
        font-family: 'Geist', sans-serif;
        font-size: 14px; font-weight: 600;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
    }
    .fp-close {
        width: 24px; height: 24px;
        border: none; background: transparent; border-radius: 4px;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        font-size: 14px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .fp-close:hover {
        background: light-dark(var(--color-surface-200), color-mix(in oklab, white 10%, transparent));
        color: light-dark(var(--color-surface-950), white);
    }

    .fp-tabs {
        display: flex; gap: 4px;
        padding: 8px 12px 0;
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .fp-tab {
        padding: 8px 12px;
        background: transparent; border: none;
        font-size: 12px; font-weight: 500;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        border-bottom: 2px solid transparent;
        cursor: pointer;
        margin-bottom: -1px;
    }
    .fp-tab:hover {
        color: light-dark(var(--color-surface-950), white);
    }
    .fp-tab.on {
        color: light-dark(var(--color-surface-950), white);
        border-bottom-color: var(--color-brand);
    }

    .fp-body {
        flex: 1; min-height: 0;
        overflow: auto;
        padding: 12px 16px;
    }

    .fp-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    .fp-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
        padding: 12px;
        background: light-dark(white, color-mix(in oklab, white 4%, transparent));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
        transition: border-color 120ms ease, background 120ms ease;
    }
    .fp-card:hover {
        border-color: var(--color-brand);
    }
    .fp-card.selected {
        border-color: var(--color-brand);
        outline: 1px solid var(--color-brand);
        outline-offset: -2px;
    }
    .fp-card-name {
        font-size: 18px; font-weight: 600;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        line-height: 1.2;
        word-break: break-word;
    }
    .fp-card-meta {
        font-family: 'Geist Mono', monospace;
        font-size: 10px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .fp-search {
        width: 100%;
        height: 32px;
        padding: 0 10px;
        margin-bottom: 10px;
        background: light-dark(white, color-mix(in oklab, white 5%, transparent));
        border: 1px solid light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        border-radius: 4px;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        font: 12px var(--font-mono, 'Geist Mono', ui-monospace, monospace);
        outline: none;
    }
    .fp-search:focus { border-color: var(--color-brand); }

    .fp-list { display: flex; flex-direction: column; gap: 2px; }
    .fp-list-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 10px;
        background: transparent;
        border: none;
        border-radius: 4px;
        text-align: left;
        cursor: pointer;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .fp-list-row:hover {
        background: light-dark(var(--color-surface-100), color-mix(in oklab, white 6%, transparent));
    }
    .fp-list-row.selected {
        background: light-dark(var(--color-surface-200), color-mix(in oklab, white 10%, transparent));
        outline: 1px solid var(--color-brand);
    }
    .fp-list-name { font-size: 13px; font-weight: 500; }
    .fp-list-meta {
        font-family: 'Geist Mono', monospace; font-size: 10px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
    }
    .fp-list-overflow {
        margin: 8px 0 0;
        padding: 0 10px;
        font-family: 'Geist Mono', monospace; font-size: 10.5px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
    }

    .fp-weight-panel {
        padding: 12px 16px;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        background: light-dark(var(--color-surface-100), var(--color-surface-950));
        display: flex; flex-direction: column; gap: 8px;
    }
    .fp-weight-head { display: flex; align-items: baseline; gap: 8px; }
    .fp-weight-label {
        font-family: 'Geist Mono', monospace; font-size: 10.5px;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        text-transform: uppercase; letter-spacing: 0.04em;
    }
    .fp-weight-family {
        font-size: 16px; font-weight: 600;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
    }
    .fp-weight-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fp-weight-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px;
        background: light-dark(white, color-mix(in oklab, white 4%, transparent));
        border: 1px solid light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        border-radius: 4px;
        font-size: 11px; font-weight: 500;
        color: light-dark(var(--color-surface-800), var(--color-surface-200));
        cursor: pointer;
    }
    .fp-weight-chip:hover { border-color: var(--color-brand); }
    .fp-weight-chip.on {
        background: var(--color-brand);
        color: black;
        border-color: var(--color-brand);
    }
    .fp-weight-chip input { margin: 0; cursor: pointer; accent-color: var(--color-brand); }
    .fp-weight-empty {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
    }

    .fp-footer {
        display: flex; justify-content: flex-end; gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .fp-btn {
        height: 32px; padding: 0 14px;
        border-radius: 4px;
        font: 12px 'Geist', sans-serif;
        font-weight: 600;
        cursor: pointer;
    }
    .fp-btn.ghost {
        background: transparent;
        border: 1px solid light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .fp-btn.ghost:hover {
        background: light-dark(var(--color-surface-100), color-mix(in oklab, white 6%, transparent));
        color: light-dark(var(--color-surface-950), white);
    }
    .fp-btn.primary {
        background: var(--color-brand);
        border: 1px solid var(--color-brand);
        color: black;
    }
    .fp-btn.primary:hover:not(:disabled) {
        filter: brightness(1.05);
    }
    .fp-btn.primary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
