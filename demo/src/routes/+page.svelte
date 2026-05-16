<script lang="ts">
    import AppBar from '$lib/components/AppBar.svelte';
</script>

<div class="app">
    <AppBar />
    <main class="placeholder">
        <p>Phase 1 complete — canvas + sheets land in Phases 2 &amp; 3.</p>
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
    .placeholder {
        display: grid;
        place-items: center;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        font-family: 'Geist', sans-serif;
        font-size: 14px;
    }
</style>
