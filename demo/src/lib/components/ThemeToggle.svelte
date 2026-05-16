<script lang="ts">
    // Read initial mode from the DOM attribute (set by the no-flash script in app.html).
    // The `data-mode` may have been changed from default 'dark' to 'light' by the
    // localStorage check before this script ever runs.
    let mode = $state<'light' | 'dark'>(
        typeof document !== 'undefined' && document.documentElement.dataset.mode === 'light'
            ? 'light' : 'dark'
    );

    function toggle() {
        mode = mode === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.mode = mode;
        try { localStorage.setItem('fitfull-mode', mode); } catch {}
    }
</script>

<button class="theme-toggle" onclick={toggle} title="Toggle theme">
    {#if mode === 'dark'}
        <!-- sun -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    {:else}
        <!-- moon -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {/if}
</button>

<style>
    .theme-toggle {
        width: 30px; height: 30px;
        display: grid; place-items: center;
        border-radius: 0.375rem;
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        cursor: pointer;
        transition: background 120ms, border-color 120ms, color 120ms;
    }
    .theme-toggle:hover {
        background: light-dark(var(--color-surface-200), var(--color-surface-800));
        border-color: light-dark(var(--color-surface-300), var(--color-surface-700));
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
</style>
