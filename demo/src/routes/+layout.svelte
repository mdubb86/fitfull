<script lang="ts">
    import { onMount } from 'svelte';
    import '../app.css';
    import { fonts } from '$lib/state/fonts.svelte';

    let { children } = $props();

    // Load the bundled default font once on mount so the canvas renders text
    // immediately instead of staying blank until the user picks a font.
    onMount(() => { fonts.loadDefault(); });
</script>

{@render children()}
