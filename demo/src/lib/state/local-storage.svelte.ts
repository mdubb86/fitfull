/**
 * Reactive localStorage hook. Returns an object with a `value` property backed
 * by a $state rune. Reads on init, writes on every change.
 *
 * Usage:
 *   const pref = persistedString('my-key', 'default');
 *   pref.value;       // read (reactive)
 *   pref.value = 'x'; // write (also persists)
 *
 * Pattern from docs/superpowers/research/2026-05-16-svelte-sveltekit.md
 * (section: "localStorage hooks").
 */
export function persistedString<T extends string>(key: string, initial: T): { value: T } {
    let value = $state(initial);
    if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key);
        if (raw !== null) value = raw as T;
    }
    $effect.root(() => {
        $effect(() => {
            if (typeof localStorage !== 'undefined') {
                try { localStorage.setItem(key, value); } catch {}
            }
        });
    });
    return {
        get value() { return value; },
        set value(v: T) { value = v; },
    };
}

/**
 * Like persistedString but for arbitrary JSON-serializable state.
 * Initial value used when localStorage is empty OR when parse fails.
 */
export function persistedJSON<T>(key: string, initial: T): { value: T } {
    let value = $state<T>(readJSON(key, initial));
    $effect.root(() => {
        $effect(() => {
            if (typeof localStorage !== 'undefined') {
                try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
            }
        });
    });
    return {
        get value() { return value; },
        set value(v: T) { value = v; },
    };
}

function readJSON<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}
