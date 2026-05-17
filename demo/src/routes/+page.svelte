<script lang="ts">
    import AppBar from '$lib/components/AppBar.svelte';
    import CanvasHeader from '$lib/components/CanvasHeader.svelte';
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
            <SheetPullTab side="left" onClick={() => ui.setLeftCollapsed(false)} />
        {/if}
        <section class="center">
            <CanvasHeader />
            <Canvas />
            <StatsBar />
        </section>
        <RightSheet />
        {#if ui.rightCollapsed}
            <SheetPullTab side="right" onClick={() => ui.setRightCollapsed(false)} />
        {/if}
    </main>
</div>

<style>
    .app {
        display: grid;
        grid-template-rows: 48px 1fr;
        /* 100dvh respects mobile browser chrome (address bar / bottom nav).
           100vh would push the StatsBar off-screen below the visible area. */
        height: 100dvh;
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
        grid-template-rows: auto 1fr auto;
        min-height: 0; min-width: 0;
    }
    /* Mobile (sheets are full-viewport modals): hide pull-tabs whenever any
       sheet is open. Without this, the open sheet covers the screen and the
       opposite pull-tab renders on top of it. Users dismiss via the in-sheet
       collapse button, then can tap the other pull-tab. */
    @media (max-width: 1023px) {
        /* :global() across the whole compound because both .sheet and .sheet-pull
           live in child components and svelte's scoper can't see either. */
        :global(main:has(.sheet:not(.collapsed)) .sheet-pull) {
            display: none;
        }
    }
</style>
