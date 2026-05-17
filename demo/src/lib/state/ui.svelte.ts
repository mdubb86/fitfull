import { persistedString } from './local-storage.svelte';

/**
 * Responsive breakpoints (px) for default sheet collapse state.
 *   ≥ LEFT_OPEN_MIN  → left open by default
 *   < LEFT_OPEN_MIN  → left collapsed by default
 *   ≥ RIGHT_OPEN_MIN → right open by default
 *   < RIGHT_OPEN_MIN → right collapsed by default
 *
 * Defaults only apply when the user has not explicitly toggled the side.
 * Once `*ToggledByUser` is true, the user's choice sticks across resizes
 * and reloads — we never fight the user.
 */
const LEFT_OPEN_MIN = 1280;
const RIGHT_OPEN_MIN = 1024;

class UIState {
    activeTab = $state<'wysiwyg' | 'tokens'>('wysiwyg');

    private _leftCollapsed = persistedString<'open' | 'collapsed'>('fitfull-left-sheet', 'open');
    private _rightCollapsed = persistedString<'open' | 'collapsed'>('fitfull-right-sheet', 'open');

    // "User has explicitly toggled this side at least once" flags. When false,
    // the side follows the breakpoint default on initial load and window resize.
    // When true, the persisted value is authoritative forever.
    private _leftToggledByUser = persistedString<'true' | 'false'>('fitfull-left-sheet-user', 'false');
    private _rightToggledByUser = persistedString<'true' | 'false'>('fitfull-right-sheet-user', 'false');

    get leftCollapsed() { return this._leftCollapsed.value === 'collapsed'; }
    get rightCollapsed() { return this._rightCollapsed.value === 'collapsed'; }

    /**
     * Set the collapsed state. When called from a user interaction (default),
     * marks the side as user-controlled so the breakpoint default no longer
     * applies on future resizes/loads.
     */
    setLeftCollapsed(value: boolean, byUser = true) {
        this._leftCollapsed.value = value ? 'collapsed' : 'open';
        if (byUser) this._leftToggledByUser.value = 'true';
    }
    setRightCollapsed(value: boolean, byUser = true) {
        this._rightCollapsed.value = value ? 'collapsed' : 'open';
        if (byUser) this._rightToggledByUser.value = 'true';
    }

    /**
     * Initialise responsive default-collapse behaviour. Must be called from a
     * browser context (e.g. onMount). Applies breakpoint defaults to any side
     * the user has not explicitly toggled, then listens for resize to keep
     * those (non-toggled) sides in sync with viewport changes.
     */
    initResponsive() {
        if (typeof window === 'undefined') return;
        const apply = () => {
            const w = window.innerWidth;
            if (this._leftToggledByUser.value !== 'true') {
                this.setLeftCollapsed(w < LEFT_OPEN_MIN, false);
            }
            if (this._rightToggledByUser.value !== 'true') {
                this.setRightCollapsed(w < RIGHT_OPEN_MIN, false);
            }
        };
        apply();
        window.addEventListener('resize', apply);
    }
}

export const ui = new UIState();
