<script lang="ts">
    import { box } from '$lib/state/box.svelte';

    // Phase 2 hardcoded values — Task 15 replaces with $derived from real fit result.
    const state: 'fit' | 'resizing' | 'fitting' = 'fit';
    const textW = 321;
    const textH = 128;
    const occupancy = 64;
    const duration = 12;
</script>

<div class="stats-bar">
    <span class="state state-{state}">
        <span class="pip"></span>
        <span>{state}</span>
    </span>
    <div class="metrics">
        <span class="grp"><span class="lbl">box</span> <b>{box.width} × {box.height}</b></span>
        <span class="grp"><span class="lbl">text</span> <b>{textW} × {textH}</b></span>
        <span class="grp"><span class="lbl">occupancy</span> <b>{occupancy}%</b></span>
        <span class="grp"><span class="lbl">aspect</span> <b>{box.aspect.toFixed(2)} : 1</b></span>
        <span class="grp"><span class="lbl">duration</span> <b>{duration}ms</b></span>
    </div>
    <div class="actions">
        <button class="btn-stats">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .svg
        </button>
        <button class="btn-stats">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .png
        </button>
    </div>
</div>

<style>
    .stats-bar {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 18px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        min-width: 0;
    }

    /* State indicator — pinned left, never shrinks */
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

    /* Metrics — fills middle, horizontally scrolls when squeezed, NEVER wraps */
    .metrics {
        flex: 1; min-width: 0;
        display: flex; align-items: center; justify-content: center;
        gap: 18px;
        overflow-x: auto;
        scrollbar-width: thin;
    }
    .metrics::-webkit-scrollbar { height: 4px; }
    .metrics::-webkit-scrollbar-thumb {
        background: light-dark(var(--color-surface-300), var(--color-surface-700));
        border-radius: 999px;
    }
    .metrics::-webkit-scrollbar-track { background: transparent; }

    .grp {
        display: flex; align-items: center; gap: 6px;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .grp .lbl { color: inherit; }
    .grp b {
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        font-weight: 500;
    }

    /* Actions — pinned right, never shrinks */
    .actions {
        display: flex; align-items: center; gap: 6px;
        flex-shrink: 0;
    }
    .btn-stats {
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
    .btn-stats:hover {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
    }
    .btn-stats svg {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
</style>
