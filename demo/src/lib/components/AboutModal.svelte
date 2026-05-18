<script lang="ts">
    import * as dialog from '@zag-js/dialog';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import { portalToBody } from '$lib/actions/portal';

    let { open = $bindable(false) }: { open?: boolean } = $props();

    const dlgId = $props.id();
    const dlgService = useMachine(dialog.machine, () => ({
        id: dlgId,
        open,
        onOpenChange: (d: { open: boolean }) => { open = d.open; },
    }));
    const dlg = $derived(dialog.connect(dlgService, normalizeProps));
</script>

{#if dlg.open}
    <div use:portalToBody {...dlg.getPositionerProps()} class="ab-positioner">
        <div {...dlg.getBackdropProps()} class="ab-backdrop"></div>
        <div {...dlg.getContentProps()} class="ab-content">
            <button {...dlg.getCloseTriggerProps()} class="ab-close" aria-label="Close">✕</button>

            <div class="ab-head">
                <div class="ab-logo">f</div>
                <div>
                    <h2 {...dlg.getTitleProps()} class="ab-title">fitfull</h2>
                    <p {...dlg.getDescriptionProps()} class="ab-tagline">Fit text into a fixed-size box and output SVG or PNG.</p>
                </div>
            </div>

            <div class="ab-body">
                <p>
                    Width, height, and a string are the inputs; font scale, line breaks, and a
                    rendered image are the outputs. Built for dynamic OG images, certificates,
                    social cards, and any pipeline that turns variable-length text into a
                    deterministic, portable image — not a scaled DOM element.
                </p>

                <h3>What sets it apart</h3>
                <ul>
                    <li><strong>Two-dimensional fit.</strong> Solves for scale against width <em>and</em> height, not just width.</li>
                    <li><strong>Wrap is part of the search.</strong> Balanced or greedy modes, with min/max line constraints — different splits yield different optimal scales.</li>
                    <li><strong>Mixed typography in one fit.</strong> Per-word font, weight, size, and color.</li>
                    <li><strong>Image output, not DOM mutation.</strong> SVG with embedded font paths (zero runtime font dependency) or PNG via resvg. Runs anywhere.</li>
                    <li><strong>Deterministic.</strong> The fit you compute is the fit you ship — no sub-pixel drift across machines.</li>
                </ul>

                <h3>This playground</h3>
                <p>
                    A static SvelteKit site that runs <code>fitfull/browser</code> entirely in your
                    tab. Type in the WYSIWYG or the JSON tokens editor; resize the box;
                    pick Google Fonts on the fly; download SVG or PNG at any scale. Nothing
                    leaves your machine.
                </p>

                <div class="ab-links">
                    <a href="https://github.com/mdubb86/fitfull" target="_blank" rel="noopener" class="ab-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.8 0-1.3.5-2.3 1.2-3.2-.1-.4-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.3.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.5-5.5 5.8.5.4.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
                        fitfull on GitHub
                    </a>
                    <a href="https://github.com/mdubb86" target="_blank" rel="noopener" class="ab-link ab-link-subtle">
                        Built by @mdubb86
                    </a>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .ab-positioner {
        position: fixed; inset: 0;
        display: grid; place-items: center;
        --z-index: 1000;
        z-index: 1000;
        padding: 24px;
    }
    .ab-backdrop {
        position: fixed; inset: 0;
        background: color-mix(in oklab, black 60%, transparent);
        backdrop-filter: blur(4px);
    }
    .ab-content {
        position: relative;
        width: 100%; max-width: 640px;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        background: light-dark(white, var(--color-surface-900));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        border-radius: 10px;
        padding: 28px 32px;
        box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6), 0 10px 20px -10px rgba(0,0,0,0.3);
        font-family: 'Geist', sans-serif;
    }
    .ab-close {
        position: absolute; top: 14px; right: 14px;
        width: 28px; height: 28px;
        border: none; background: transparent;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        font-size: 14px; cursor: pointer;
        border-radius: 4px;
        display: grid; place-items: center;
    }
    .ab-close:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), white);
    }

    .ab-head {
        display: flex; align-items: center; gap: 16px;
        margin-bottom: 20px;
    }
    .ab-logo {
        width: 44px; height: 44px;
        border-radius: 8px;
        background: var(--color-brand);
        color: light-dark(white, oklch(0.18 0.008 80));
        display: grid; place-items: center;
        font-family: 'Geist Mono', monospace;
        font-weight: 700; font-size: 22px;
        letter-spacing: -0.04em;
        flex-shrink: 0;
    }
    .ab-title {
        margin: 0;
        font-size: 22px; font-weight: 600;
        letter-spacing: -0.02em;
    }
    .ab-tagline {
        margin: 2px 0 0;
        font-size: 13px;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    .ab-body p {
        margin: 0 0 14px;
        font-size: 14px; line-height: 1.55;
        color: light-dark(var(--color-surface-700), var(--color-surface-200));
    }
    .ab-body h3 {
        margin: 22px 0 10px;
        font-size: 13px; font-weight: 600;
        letter-spacing: 0.06em; text-transform: uppercase;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
    }
    .ab-body ul {
        margin: 0 0 14px;
        padding-left: 18px;
        font-size: 14px; line-height: 1.55;
        color: light-dark(var(--color-surface-700), var(--color-surface-200));
    }
    .ab-body ul li { margin-bottom: 6px; }
    .ab-body code {
        font-family: 'Geist Mono', monospace; font-size: 12.5px;
        padding: 1px 5px; border-radius: 3px;
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
    }

    .ab-links {
        display: flex; flex-wrap: wrap; gap: 10px;
        margin-top: 22px;
        padding-top: 18px;
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
    }
    .ab-link {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 13px; font-weight: 500;
        background: var(--color-brand);
        color: light-dark(white, oklch(0.18 0.008 80));
        text-decoration: none;
        transition: opacity 120ms;
    }
    .ab-link:hover { opacity: 0.88; }
    .ab-link-subtle {
        background: transparent;
        border: 1px solid light-dark(var(--color-surface-300), var(--color-surface-700));
        color: light-dark(var(--color-surface-700), var(--color-surface-300));
    }
    .ab-link-subtle:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        opacity: 1;
    }
</style>
