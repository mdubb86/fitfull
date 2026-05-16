<script lang="ts">
    import { fit } from '$lib/fitfull/fit.svelte';

    const state = $derived(fit.state);
</script>

<div class="canvas-header">
    <span class="state state-{state}">
        <span class="pip"></span>
        <span>{state}</span>
    </span>
    <div class="actions">
        <button class="btn-action">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .svg
        </button>
        <button class="btn-action">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .png
        </button>
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
    .btn-action:hover {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
    }
    .btn-action svg {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
</style>
