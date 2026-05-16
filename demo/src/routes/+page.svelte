<script lang="ts">
    import AppBar from '$lib/components/AppBar.svelte';
    import StatsBar from '$lib/components/StatsBar.svelte';
</script>

<div class="app">
    <AppBar />
    <main>
        <StatsBar />
        <section class="canvas-placeholder">
            <p>Canvas + drag lands in Tasks 11–12.</p>
        </section>
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
    .canvas-placeholder {
        display: grid;
        place-items: center;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        font-family: 'Geist', sans-serif;
        font-size: 14px;
        background: light-dark(var(--color-surface-100), var(--color-surface-950));
    }
</style>
