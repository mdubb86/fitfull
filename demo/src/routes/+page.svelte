<script lang="ts">
    import AppBar from '$lib/components/AppBar.svelte';
    import StatsBar from '$lib/components/StatsBar.svelte';
    import Canvas from '$lib/components/Canvas.svelte';
</script>

<div class="app">
    <AppBar />
    <main>
        <StatsBar />
        <Canvas />
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
        grid-template-rows: auto 1fr;
        min-height: 0;
    }
</style>
