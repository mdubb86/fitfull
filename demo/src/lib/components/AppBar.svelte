<script lang="ts">
    import ThemeToggle from './ThemeToggle.svelte';
    import AboutModal from './AboutModal.svelte';

    // Library version — hardcoded for now. If version drift becomes an issue,
    // wire to import.meta.env via vite-define plugin.
    const VERSION = '1.4.0';

    let aboutOpen = $state(false);
</script>

<header class="appbar">
    <!-- Lead: logo + version -->
    <div class="lead">
        <div class="logo">f</div>
        <span class="badge">v{VERSION}</span>
    </div>

    <!-- Headline: centered title -->
    <div class="headline">
        <span class="title">Fitfull <em>Playground</em></span>
    </div>

    <!-- Trail: About + GitHub + theme toggle -->
    <div class="trail">
        <button class="icon-btn" onclick={() => aboutOpen = true} title="About fitfull" aria-label="About fitfull">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="11"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        </button>
        <a class="icon-btn" href="https://github.com/mdubb86/fitfull" target="_blank" title="GitHub">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.8 0-1.3.5-2.3 1.2-3.2-.1-.4-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.3.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.5-5.5 5.8.5.4.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
        </a>
        <ThemeToggle />
    </div>
</header>

<AboutModal bind:open={aboutOpen} />

<style>
    .appbar {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        padding: 0 16px;
        gap: 24px;
        height: 48px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .lead {
        display: flex; align-items: center; gap: 14px;
    }
    .logo {
        width: 28px; height: 28px;
        border-radius: 0.375rem;
        background: var(--color-brand);
        color: light-dark(white, oklch(0.18 0.008 80));
        display: grid; place-items: center;
        font-family: 'Geist Mono', monospace;
        font-weight: 700; font-size: 14px;
        letter-spacing: -0.04em;
        flex-shrink: 0;
    }
    .badge {
        font-family: 'Geist Mono', monospace;
        font-size: 10.5px; font-weight: 500;
        border-radius: 4px; padding: 2px 6px;
        background: color-mix(in oklab, var(--color-brand) 18%, transparent);
        color: var(--color-brand);
    }
    .headline {
        display: flex; justify-content: center; align-items: center;
    }
    .title {
        font-family: 'Geist', sans-serif;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
    .title em {
        font-style: normal;
        color: var(--color-brand);
        font-weight: 600;
    }
    .trail {
        display: flex; align-items: center; gap: 6px;
    }
    .icon-btn {
        width: 30px; height: 30px;
        padding: 0;
        background: transparent;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
        display: grid; place-items: center;
        cursor: pointer;
        transition: background 120ms, border-color 120ms, color 120ms;
    }
    .icon-btn:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-900));
        border-color: light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }
</style>
