<script lang="ts">
    import { ui } from '$lib/state/ui.svelte';
    import WysiwygEditor from './WysiwygEditor.svelte';
    import TokensEditor from './TokensEditor.svelte';
    import FontsInventory from './FontsInventory.svelte';
</script>

<aside class="sheet sheet-left" class:collapsed={ui.leftCollapsed}>
    <div class="sheet-head">
        <span class="sheet-title">Input</span>
        <button class="sheet-toggle" onclick={() => ui.setLeftCollapsed(true)} title="Hide input sheet">‹</button>
    </div>
    <div class="sheet-body">
        <div class="tab-toggle">
            <div class="seg">
                <button class:active={ui.activeTab === 'wysiwyg'} onclick={() => ui.activeTab = 'wysiwyg'}>
                    WYSIWYG <span class="mono">visual</span>
                </button>
                <button class:active={ui.activeTab === 'tokens'} onclick={() => ui.activeTab = 'tokens'}>
                    Tokens <span class="mono">.json</span>
                </button>
            </div>
        </div>

        {#if ui.activeTab === 'wysiwyg'}
            <WysiwygEditor />
        {:else}
            <TokensEditor />
        {/if}

        <div class="section">
            <div class="section-head">
                <span class="name">
                    <span class="dot"></span>
                    Fonts
                </span>
            </div>
            <div class="section-body">
                <FontsInventory />
            </div>
        </div>
    </div>
</aside>

<style>
    .sheet {
        width: 420px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-right: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        min-height: 0; min-width: 0; overflow: hidden;
        transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sheet.collapsed { width: 0; border: none; }
    .sheet-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 16px;
        height: 48px;
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .sheet-title {
        font-size: 10.5px; font-weight: 600;
        letter-spacing: 0.14em; text-transform: uppercase;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .sheet-toggle {
        width: 22px; height: 22px;
        display: grid; place-items: center;
        border-radius: 4px; border: none;
        background: transparent;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        font-size: 14px; cursor: pointer;
    }
    .sheet-toggle:hover {
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
    }
    .sheet-body { overflow-y: auto; min-height: 0; }
    .tab-toggle {
        padding: 12px 14px;
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .seg {
        display: grid; grid-template-columns: 1fr 1fr;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 0.375rem;
        padding: 2px; gap: 2px;
    }
    .seg button {
        font-size: 12px; font-weight: 500;
        color: light-dark(var(--color-surface-600), var(--color-surface-300));
        padding: 6px 8px; border-radius: 4px;
        border: none; background: transparent; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .seg button.active {
        background: light-dark(white, var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        box-shadow: inset 0 0 0 1px light-dark(var(--color-surface-200), var(--color-surface-700));
    }
    .seg button .mono {
        font-family: 'Geist Mono', monospace; font-size: 10px;
        color: light-dark(var(--color-surface-400), var(--color-surface-500));
    }
    .section { border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800)); }
    .section-head { display: flex; align-items: center; padding: 12px 14px; }
    .section-head .name {
        font-size: 12px; font-weight: 500;
        display: flex; align-items: center; gap: 8px;
    }
    .section-head .dot {
        width: 4px; height: 4px; border-radius: 999px;
        background: var(--color-brand); opacity: 0.7;
    }
    .section-body { padding: 4px 14px 14px; }
</style>
