<script lang="ts">
    import { fonts } from '$lib/state/fonts.svelte';

    // For now the Add button just logs — Dispatch 3 wires the modal.
    function openPicker() {
        console.log('[Phase 5 D3] picker modal not wired yet');
    }
</script>

<div class="fonts-inventory">
    {#if fonts.families().length === 0}
        <p class="empty">No fonts loaded yet. Click + below to add one.</p>
    {:else}
        {#each fonts.families() as family (family)}
            {@const weights = fonts.weightStatuses(family)}
            {@const totalRuns = weights.reduce((s, w) => s + w.runs, 0)}
            <div class="font-row">
                <div class="font-row-head">
                    <span class="font-family" style="font-family: '{family}', sans-serif;">{family}</span>
                    <button
                        class="font-remove"
                        title={totalRuns > 0 ? `In use by ${totalRuns} run(s)` : `Remove ${family}`}
                        disabled={totalRuns > 0}
                        onclick={() => fonts.removeFont(family)}
                    >✕</button>
                </div>
                <div class="weight-chips">
                    {#each weights as w (w.weight)}
                        <span class="weight-chip status-{w.status}" title={w.error ?? w.status}>
                            <span class="pip"></span>
                            <span class="weight-label">{w.weight}</span>
                            {#if w.runs > 0}<span class="runs">·{w.runs}</span>{/if}
                        </span>
                    {/each}
                </div>
            </div>
        {/each}
    {/if}
    <button class="add-btn" onclick={openPicker}>+ Add font from Google Fonts</button>
</div>

<style>
    .fonts-inventory { display: flex; flex-direction: column; gap: 8px; }
    .empty {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        padding: 0;
    }
    .font-row {
        display: flex; flex-direction: column; gap: 6px;
        padding: 8px 0;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .font-row:first-child { border-top: none; padding-top: 0; }
    .font-row-head { display: flex; align-items: center; justify-content: space-between; }
    .font-family {
        font-size: 13px; font-weight: 500;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
    }
    .font-remove {
        width: 20px; height: 20px;
        border: none; background: transparent; border-radius: 3px;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        font-size: 12px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .font-remove:hover:not(:disabled) {
        background: light-dark(var(--color-surface-200), var(--color-surface-700));
        color: light-dark(var(--color-surface-950), white);
    }
    .font-remove:disabled { opacity: 0.3; cursor: not-allowed; }
    .weight-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .weight-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 6px;
        font-family: 'Geist Mono', monospace; font-size: 10px;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 3px;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .weight-chip .pip {
        width: 6px; height: 6px; border-radius: 999px; background: currentColor;
    }
    .weight-chip.status-loading { color: var(--color-warning-500); }
    .weight-chip.status-loaded  { color: var(--color-brand); }
    .weight-chip.status-error   { color: var(--color-error-500); }
    .weight-chip .weight-label {
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .weight-chip .runs {
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
    }
    .add-btn {
        margin-top: 4px;
        padding: 8px;
        background: transparent;
        border: 1px dashed light-dark(var(--color-surface-300), var(--color-surface-700));
        border-radius: 4px;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        font-size: 12px; font-weight: 500;
        cursor: pointer;
    }
    .add-btn:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border-color: var(--color-brand);
        color: var(--color-brand);
    }
</style>
