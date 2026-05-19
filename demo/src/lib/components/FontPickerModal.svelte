<script lang="ts">
    import * as dialog from '@zag-js/dialog';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import { fonts } from '$lib/state/fonts.svelte';
    import { getCatalog, type FontFamily } from '$lib/fonts/catalog';
    import { portalToBody } from '$lib/actions/portal';

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
                // next open starts on the Featured tab.
                resetPickerState();
            }
        },
    }));
    const api = $derived(dialog.connect(service, normalizeProps));

    function resetPickerState() {
        tab = 'featured';
        search = '';
    }

    // Featured cards built from the catalog where possible (so we know their
    // available weights). If a featured family isn't in the catalog it still
    // renders, but loadFamily will no-op for it.
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

    function pickFamily(family: string) {
        // Close-first for snappy UX — load happens in the background. The
        // family appears in the inventory immediately (with a 'loading' pip).
        open = false;
        onSelected?.(family);
        void fonts.loadFamily(family);
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
                            onclick={() => pickFamily(ff.family)}
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
                            onclick={() => pickFamily(ff.family)}
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
                        <p class="fp-list-overflow">No families match "{search}".</p>
                    {/if}
                </div>
            {/if}
        </div>
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
</style>
