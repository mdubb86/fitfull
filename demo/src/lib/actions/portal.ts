// DOM-level portal: moves the node to document.body without re-mounting a
// new Svelte component context (preserves Svelte 5's event delegation).
// Skeleton's <Portal> uses Svelte's mount() which spins up a fresh
// delegation root, which silently breaks Zag's pointer-event handlers.
//
// Shared between ColorPickerButton and FontPickerModal — both need their
// floating UI nodes parented to <body> to escape stacking contexts.
export function portalToBody(node: HTMLElement) {
    document.body.appendChild(node);
    return {
        destroy() { node.parentElement?.removeChild(node); },
    };
}
