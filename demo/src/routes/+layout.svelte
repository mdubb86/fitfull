<script lang="ts">
    import { onMount } from 'svelte';
    import '../app.css';
    import { fonts } from '$lib/state/fonts.svelte';
    import { ui } from '$lib/state/ui.svelte';
    import { applyHashFromUrl } from '$lib/state/url-hash.svelte';

    let { children } = $props();

    // Load the bundled default font once on mount so the canvas renders text
    // immediately instead of staying blank until the user picks a font.
    // Then apply any state encoded in the URL hash (additive — it only loads
    // extra families on top of the default Geist registration).
    // Also wire up responsive sheet defaults (collapse based on viewport on
    // initial load + resize, unless the user has explicitly toggled a side).
    onMount(() => {
        fonts.loadDefault();
        ui.initResponsive();
        void applyHashFromUrl();
    });
</script>

{@render children()}
