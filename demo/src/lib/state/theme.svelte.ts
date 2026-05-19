// Module-singleton for the current theme mode.
//
// Source of truth at first paint is `document.documentElement.dataset.mode`
// set by app.html's no-flash script. After hydration this state takes over;
// ThemeToggle drives it via cycle(), and consumers (e.g. fit.svelte.ts) read
// `theme.mode` reactively to re-render in a contrasting default color.

export type ThemePref = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'fitfull-mode';

function readPref(): ThemePref {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
}

function resolveMode(p: ThemePref): ThemeMode {
    if (p === 'system') {
        return typeof matchMedia !== 'undefined' &&
            matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light';
    }
    return p;
}

class ThemeState {
    pref = $state<ThemePref>(typeof window === 'undefined' ? 'system' : readPref());
    mode = $state<ThemeMode>(typeof window === 'undefined' ? 'dark' : resolveMode(this.pref));

    /** Cycle dark → light → system → dark. Persists to localStorage. */
    cycle() {
        const order: ThemePref[] = ['dark', 'light', 'system'];
        const idx = order.indexOf(this.pref);
        this.pref = order[(idx + 1) % order.length];
        try { localStorage.setItem(STORAGE_KEY, this.pref); } catch {}
        this.applyResolved();
    }

    /** Re-evaluate mode from pref + OS preference and write to documentElement. */
    applyResolved() {
        this.mode = resolveMode(this.pref);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.mode = this.mode;
        }
    }

    /** Attach a `matchMedia` listener. Returns cleanup. Caller uses inside $effect. */
    listenForOsPreference(): () => void {
        if (typeof matchMedia === 'undefined') return () => {};
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (this.pref === 'system') this.applyResolved();
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }
}

export const theme = new ThemeState();
