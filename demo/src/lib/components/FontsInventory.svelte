<script lang="ts">
    import { fonts } from '$lib/state/fonts.svelte';
    import FontPickerModal from './FontPickerModal.svelte';

    let pickerOpen = $state(false);

    function openPicker() {
        pickerOpen = true;
    }
</script>

<div class="fonts-inventory">
    {#if fonts.families().length === 0}
        <p class="empty">No fonts loaded yet. Click + below to add one.</p>
    {:else}
        {#each fonts.families() as family (family)}
            {@const runs = fonts.runs(family)}
            <div class="font-row">
                <span class="pip status-{fonts.familyStatus(family)}"></span>
                <span class="font-family" style="font-family: '{family}', sans-serif;">{family}</span>
                <span class="flex-spacer"></span>
                <button
                    class="font-remove"
                    title={runs > 0 ? `In use by ${runs} run(s)` : `Remove ${family}`}
                    disabled={runs > 0}
                    onclick={() => fonts.removeFont(family)}
                >✕</button>
            </div>
        {/each}
    {/if}
    <button class="add-btn" onclick={openPicker}>+ Add font from Google Fonts</button>
</div>

<FontPickerModal bind:open={pickerOpen} />

<style>
    .fonts-inventory { display: flex; flex-direction: column; gap: 4px; }
    .empty {
        font-family: 'Geist Mono', monospace; font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        padding: 0;
    }
    .font-row {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 0;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .font-row:first-child { border-top: none; padding-top: 0; }
    .flex-spacer { flex: 1; }
    .pip {
        width: 8px; height: 8px; border-radius: 999px; background: currentColor;
        flex-shrink: 0;
    }
    .pip.status-loading { color: var(--color-warning-500); }
    .pip.status-loaded  { color: var(--color-brand); }
    .pip.status-error   { color: var(--color-error-500); }
    .pip.status-unknown { color: light-dark(var(--color-surface-400), var(--color-surface-600)); }
    .font-family {
        font-size: 13px; font-weight: 500;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0;
    }
    .font-remove {
        width: 20px; height: 20px;
        border: none; background: transparent; border-radius: 3px;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        font-size: 12px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .font-remove:hover:not(:disabled) {
        background: light-dark(var(--color-surface-200), var(--color-surface-700));
        color: light-dark(var(--color-surface-950), white);
    }
    .font-remove:disabled { opacity: 0.3; cursor: not-allowed; }
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
