<script lang="ts">
    let { side, onClick }: { side: 'left' | 'right'; onClick: () => void } = $props();
</script>

<button class="sheet-pull sheet-pull-{side}"
        onclick={onClick}
        title={side === 'left' ? 'Show input sheet' : 'Show settings sheet'}>
    {side === 'left' ? '›' : '‹'}
</button>

<style>
    .sheet-pull {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 16px; height: 56px;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        display: grid; place-items: center;
        cursor: pointer; z-index: 4;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        font-size: 12px;
        transition: background 120ms, border-color 120ms, color 120ms;
    }
    .sheet-pull:hover {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        color: var(--color-brand);
    }
    .sheet-pull-left  { left: 0;  border-left: none;  border-radius: 0 4px 4px 0; }
    .sheet-pull-right { right: 0; border-right: none; border-radius: 4px 0 0 4px; }
</style>
