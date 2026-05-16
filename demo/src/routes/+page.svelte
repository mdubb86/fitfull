<script lang="ts">
    import AppBar from '$lib/components/AppBar.svelte';
    import StatsBar from '$lib/components/StatsBar.svelte';
    import Canvas from '$lib/components/Canvas.svelte';
    import LeftSheet from '$lib/components/LeftSheet.svelte';
    import RightSheet from '$lib/components/RightSheet.svelte';
    import SheetPullTab from '$lib/components/SheetPullTab.svelte';
    import { ui } from '$lib/state/ui.svelte';
</script>

<div class="app">
    <AppBar />
    <main>
        <LeftSheet />
        {#if ui.leftCollapsed}
            <SheetPullTab side="left" onClick={() => ui.leftCollapsed = false} />
        {/if}
        <section class="center">
            <StatsBar />
            <Canvas />
        </section>
        <RightSheet />
        {#if ui.rightCollapsed}
            <SheetPullTab side="right" onClick={() => ui.rightCollapsed = false} />
        {/if}
    </main>
</div>

<style>
    .app {
        display: grid;
        grid-template-rows: 56px 1fr;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    main {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        min-height: 0; min-width: 0;
        position: relative;  /* pull-tabs are absolute relative to this */
    }
    .center {
        display: grid;
        grid-template-rows: auto 1fr;
        min-height: 0; min-width: 0;
    }
</style>
