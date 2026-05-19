<script lang="ts">
    import { theme } from '$lib/state/theme.svelte';

    // OS-preference listener (only active while pref === 'system').
    $effect(() => theme.listenForOsPreference());

    const title = $derived(
        `Theme: ${theme.pref}${theme.pref === 'system' ? ` (currently ${theme.mode})` : ''}`
    );
</script>

<button class="theme-toggle" onclick={() => theme.cycle()} {title} aria-label={title}>
    {#if theme.pref === 'dark'}
        <!-- moon -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {:else if theme.pref === 'light'}
        <!-- sun -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    {:else}
        <!-- monitor / system -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
    {/if}
</button>

<style>
    /* Match the AppBar's .icon-btn (GitHub link): flat at rest, button on hover. */
    .theme-toggle {
        width: 30px; height: 30px;
        display: grid; place-items: center;
        border-radius: 0.375rem;
        background: transparent;
        border: 1px solid transparent;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        cursor: pointer;
        transition: background 120ms, border-color 120ms, color 120ms;
    }
    .theme-toggle:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border-color: light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
</style>
