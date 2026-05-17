<script lang="ts">
    import * as menu from '@zag-js/menu';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import { fit } from '$lib/fitfull/fit.svelte';
    import { downloadSvg } from '$lib/exports/svg';
    import { downloadPng } from '$lib/exports/png';
    import { buildShareUrl } from '$lib/state/url-hash.svelte';
    import { portalToBody } from '$lib/actions/portal';

    const fitState = $derived(fit.state);
    const canExport = $derived(fit.result !== null);

    // Natural PNG dims = the SVG's natural size, which equals the fitted text
    // bbox (round here so the menu shows clean integers).
    const naturalW = $derived(Math.round(fit.result?.width ?? 0));
    const naturalH = $derived(Math.round(fit.result?.height ?? 0));
    const pngScales = [1, 2, 3];

    const pngMenuId = $props.id();
    const pngMenuService = useMachine(menu.machine, () => ({
        id: pngMenuId,
        positioning: { placement: 'bottom-end' as const, gutter: 4 },
        onSelect: (details: { value: string }) => {
            const scale = parseInt(details.value, 10);
            if (Number.isFinite(scale) && scale > 0) downloadPng(undefined, scale);
        },
    }));
    const pngMenuApi = $derived(menu.connect(pngMenuService, normalizeProps));

    let copiedFlash = $state(false);
    let copiedTimer: ReturnType<typeof setTimeout> | null = null;

    async function copyShareUrl() {
        const url = buildShareUrl();
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Clipboard API can fail (insecure context, denied permission, etc.).
            // For v1 we just log — the URL is still visible in the address bar
            // because the outbound effect keeps the hash up to date.
            console.warn('Clipboard write failed; URL:', url);
        }
        copiedFlash = true;
        if (copiedTimer) clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => {
            copiedFlash = false;
        }, 1500);
    }
</script>

<div class="canvas-header">
    <span class="state state-{fitState}">
        <span class="pip"></span>
        <span>{fitState}</span>
    </span>
    <div class="actions">
        <button class="btn-action" onclick={copyShareUrl} title="Copy shareable URL">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {copiedFlash ? 'Copied!' : 'Share'}
        </button>
        <button class="btn-action" onclick={() => downloadSvg()} disabled={!canExport}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .svg
        </button>
        <button {...pngMenuApi.getTriggerProps()} class="btn-action" disabled={!canExport}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .png
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
    </div>
</div>

<div use:portalToBody {...pngMenuApi.getPositionerProps()} class="png-menu-positioner">
    <div {...pngMenuApi.getContentProps()} class="png-menu-content">
        {#each pngScales as s (s)}
            <div
                {...pngMenuApi.getItemProps({ value: String(s) })}
                class="png-menu-item"
            >
                <span class="scale">{s}×</span>
                <span class="dims">{naturalW * s} × {naturalH * s}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .canvas-header {
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
        padding: 0 18px;
        height: 48px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        min-width: 0;
    }

    .state {
        display: inline-flex; align-items: center; gap: 6px;
        min-width: 70px;
        flex-shrink: 0;
        transition: color 120ms;
    }
    .state .pip {
        width: 6px; height: 6px;
        border-radius: 999px;
        background: currentColor;
        transition: background 120ms, box-shadow 120ms;
    }
    .state-fit { color: var(--color-brand); }
    .state-fit .pip {
        background: var(--color-brand);
        box-shadow: 0 0 8px var(--color-brand);
        animation: pulse 1.6s ease-in-out infinite;
    }
    .state-resizing { color: var(--color-warning-500); }
    .state-resizing .pip {
        background: var(--color-warning-500);
        box-shadow: 0 0 8px var(--color-warning-500);
        animation: pulse 0.6s ease-in-out infinite;
    }
    .state-fitting {
        color: light-dark(var(--color-surface-800), var(--color-surface-200));
    }
    .state-fitting .pip {
        animation: pulse 0.4s ease-in-out infinite;
    }
    @keyframes pulse { 50% { opacity: 0.4; } }

    .actions {
        display: flex; align-items: center; gap: 6px;
        flex-shrink: 0;
    }
    .btn-action {
        font-family: 'Geist', sans-serif;
        font-size: 12px; font-weight: 500;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 0.375rem;
        padding: 5px 10px;
        display: inline-flex; align-items: center; gap: 5px;
        cursor: pointer;
        transition: background 120ms, border-color 120ms;
    }
    .btn-action:hover:not(:disabled) {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
    }
    .btn-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-action svg {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    /* PNG scale menu — Zag dropdown listing 1×/2×/3× with output dims. */
    .png-menu-positioner { --z-index: 1000; }
    .png-menu-content {
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        border-radius: 6px;
        padding: 4px;
        min-width: 140px;
        box-shadow: 0 10px 30px -8px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.25);
        font-family: 'Geist', sans-serif;
        font-size: 12px;
    }
    .png-menu-content:focus { outline: none; }
    .png-menu-item {
        display: flex; align-items: center; justify-content: space-between; gap: 16px;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        color: light-dark(var(--color-surface-700), var(--color-surface-200));
    }
    .png-menu-item[data-highlighted] {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), white);
    }
    .png-menu-item .scale { font-weight: 500; }
    .png-menu-item .dims {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
    }
</style>
