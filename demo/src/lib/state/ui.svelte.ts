import { persistedString } from './local-storage.svelte';

class UIState {
    activeTab = $state<'wysiwyg' | 'tokens'>('wysiwyg');

    private _leftCollapsed = persistedString<'open' | 'collapsed'>('fitfull-left-sheet', 'open');
    private _rightCollapsed = persistedString<'open' | 'collapsed'>('fitfull-right-sheet', 'open');

    get leftCollapsed() { return this._leftCollapsed.value === 'collapsed'; }
    set leftCollapsed(v: boolean) { this._leftCollapsed.value = v ? 'collapsed' : 'open'; }

    get rightCollapsed() { return this._rightCollapsed.value === 'collapsed'; }
    set rightCollapsed(v: boolean) { this._rightCollapsed.value = v ? 'collapsed' : 'open'; }
}

export const ui = new UIState();
