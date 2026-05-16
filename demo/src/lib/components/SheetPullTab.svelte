<script lang="ts">
    let { side, onClick }: { side: 'left' | 'right'; onClick: () => void } = $props();
</script>

<button class="sheet-pull sheet-pull-{side}"
        onclick={onClick}
        title={side === 'left' ? 'Show input sheet' : 'Show settings sheet'}
        aria-label={side === 'left' ? 'Show input sheet' : 'Show settings sheet'}>
    {#if side === 'left'}
        <!-- "Type/Text" icon — hints at the editor that's hidden behind this tab -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 7 4 4 20 4 20 7"/>
            <line x1="9" y1="20" x2="15" y2="20"/>
            <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
    {:else}
        <!-- "Sliders" icon — hints at the settings that are hidden behind this tab -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/>
            <line x1="9" y1="8" x2="15" y2="8"/>
            <line x1="17" y1="16" x2="23" y2="16"/>
        </svg>
    {/if}
</button>

<style>
    .sheet-pull {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 24px; height: 64px;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        display: grid; place-items: center;
        cursor: pointer; z-index: 4;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        transition: background 120ms, border-color 120ms, color 120ms, width 120ms;
    }
    .sheet-pull:hover {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
        color: var(--color-brand);
        width: 28px;
    }
    .sheet-pull-left  { left: 0;  border-left: none;  border-radius: 0 6px 6px 0; }
    .sheet-pull-right { right: 0; border-right: none; border-radius: 6px 0 0 6px; }
</style>
