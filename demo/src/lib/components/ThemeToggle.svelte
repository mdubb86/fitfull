<script lang="ts">
    type Pref = 'system' | 'light' | 'dark';
    type Mode = 'light' | 'dark';

    // User preference (what they explicitly chose). 'system' = follow OS preference.
    let pref = $state<Pref>(readPref());

    function readPref(): Pref {
        if (typeof localStorage === 'undefined') return 'system';
        const stored = localStorage.getItem('fitfull-mode');
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
        return 'system';
    }

    function resolveMode(p: Pref): Mode {
        if (p === 'system') {
            return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        }
        return p;
    }

    function applyMode() {
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.mode = resolveMode(pref);
        }
    }

    // Cycle: dark → light → system → dark. System (default) returns at the end of
    // the cycle so explicit modes feel like overrides on top of the OS default.
    function cycle() {
        const order: Pref[] = ['dark', 'light', 'system'];
        const idx = order.indexOf(pref);
        pref = order[(idx + 1) % order.length];
        try { localStorage.setItem('fitfull-mode', pref); } catch {}
        applyMode();
    }

    // When pref is 'system', listen for OS preference changes and re-apply.
    $effect(() => {
        if (pref !== 'system' || typeof matchMedia === 'undefined') return;
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyMode();
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    });

    const title = $derived(
        `Theme: ${pref}${pref === 'system' ? ` (currently ${resolveMode(pref)})` : ''}`
    );
</script>

<button class="theme-toggle" onclick={cycle} {title} aria-label={title}>
    {#if pref === 'dark'}
        <!-- moon -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {:else if pref === 'light'}
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
