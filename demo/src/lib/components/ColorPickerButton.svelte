<script lang="ts">
    import * as colorPicker from '@zag-js/color-picker';
    import { normalizeProps, useMachine } from '@zag-js/svelte';
    import { persistedJSON } from '$lib/state/local-storage.svelte';
    import { portalToBody } from '$lib/actions/portal';

    type Props = {
        color: string;                       // hex, e.g. "#d4ff4a"
        onChange: (hex: string) => void;     // called on drag-end + on swatch click
        label?: string;                      // tooltip + a11y label on the trigger
        /** Show a checkerboard swatch instead of `color` — used by the
         *  Background picker when bgColor is null (transparent). */
        transparent?: boolean;
        /** When provided, the picker shows a "Transparent" tile in the
         *  favorites strip that calls this to clear back to no-color. */
        onClear?: () => void;
        /** Render the trigger full-width with a tall rectangular swatch.
         *  Right-sheet color fields use this; toolbar buttons stay inline. */
        block?: boolean;
    };
    const { color, onChange, label = 'Color', transparent = false, onClear, block = false }: Props = $props();

    // Favorites — MRU stack of hex strings, persisted to localStorage. Brand amber first.
    const DEFAULT_FAVORITES = ['#c79941', '#ffffff', '#ff5555', '#5599ff', '#ffcc00', '#000000'];
    const favorites = persistedJSON<string[]>('fitfull-color-favorites', DEFAULT_FAVORITES);

    function addCurrentToFavorites() {
        const hex = api.value.toString('hex').toLowerCase();
        const filtered = favorites.value.filter((c) => c.toLowerCase() !== hex);
        favorites.value = [hex, ...filtered].slice(0, 12);
    }

    function removeFavorite(hex: string) {
        favorites.value = favorites.value.filter((c) => c.toLowerCase() !== hex.toLowerCase());
    }

    const id = $props.id();
    const service = useMachine(colorPicker.machine, () => ({
        id,
        // `defaultValue` = uncontrolled (machine owns the value internally).
        // Using `value:` would make it controlled, freezing the machine to the
        // prop and ignoring area/slider clicks until we manually push updates back.
        defaultValue: colorPicker.parse(color || '#000000'),
        // HSB (= HSV) gives us the conventional hue slider + SV area. RGBA format
        // has no 'hue' channel, so the hue slider renders blank under it.
        format: 'hsba' as const,
        positioning: { placement: 'bottom-end' as const, gutter: 6 },
        closeOnSelect: false,
        onValueChangeEnd: (details: colorPicker.ValueChangeDetails) => {
            onChange(details.value.toString('hex'));
        },
    }));
    const api = $derived(colorPicker.connect(service, normalizeProps));

    const areaChannels = { xChannel: 'saturation' as const, yChannel: 'brightness' as const };
</script>

<div {...api.getRootProps()} class="cp-root" class:cp-root-block={block}>
    <button {...api.getTriggerProps()} class="cp-trigger" title={label} aria-label={label}>
        <!-- Trigger swatch reflects the PARENT's `color` prop, not Zag's
             machine value — favorite clicks bypass the machine, so api.value
             would lag and display the original init color (typically white).
             Parsing the prop on every render keeps the swatch in sync with
             whatever the parent considers current. -->
        <span class="cp-swatch-wrap">
            <span
                class="cp-swatch"
                {...api.getSwatchProps({ value: colorPicker.parse(color || '#000000') })}
            ></span>
            {#if transparent}
                <span class="cp-swatch-checker" aria-hidden="true"></span>
            {/if}
        </span>
    </button>

    <div use:portalToBody {...api.getPositionerProps()} class="cp-positioner">
        <div {...api.getContentProps()} class="cp-content">
            <!-- 2D SV area -->
            <div {...api.getAreaProps(areaChannels)} class="cp-area">
                <div {...api.getAreaBackgroundProps(areaChannels)} class="cp-area-bg"></div>
                <div {...api.getAreaThumbProps(areaChannels)} class="cp-area-thumb"></div>
            </div>

            <!-- Hue slider -->
            <div {...api.getChannelSliderProps({ channel: 'hue' })} class="cp-slider">
                <div {...api.getChannelSliderTrackProps({ channel: 'hue' })} class="cp-slider-track"></div>
                <div {...api.getChannelSliderThumbProps({ channel: 'hue' })} class="cp-slider-thumb"></div>
            </div>

            <!-- Hex input + star button -->
            <label class="cp-hex">
                <span>HEX</span>
                <input {...api.getChannelInputProps({ channel: 'hex' })} />
                <button type="button" class="cp-fav-add" title="Add to favorites" onclick={addCurrentToFavorites}>★</button>
            </label>

            <!-- Favorites strip (shift-click to remove). When the parent
                 supplies an onClear, prepend a "Transparent" tile so the
                 picker itself is a way back to no-color (not just the ✕ next
                 to the field label, which is easy to miss). -->
            <div {...api.getSwatchGroupProps()} class="cp-favs">
                {#if onClear}
                    <button
                        type="button"
                        class="cp-fav cp-fav-clear"
                        title="Transparent (no background)"
                        onclick={() => onClear()}
                    >
                        <span class="cp-fav-swatch cp-fav-swatch-transparent"></span>
                    </button>
                {/if}
                {#each favorites.value as hex (hex)}
                    <button
                        {...api.getSwatchTriggerProps({ value: hex })}
                        class="cp-fav"
                        title="{hex} (shift-click to remove)"
                        onclick={(e: MouseEvent) => {
                            if (e.shiftKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                removeFavorite(hex);
                            } else {
                                onChange(hex);
                            }
                        }}
                    >
                        <span {...api.getSwatchProps({ value: hex })} class="cp-fav-swatch"></span>
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .cp-root { display: inline-block; }
    /* Block variant — picker fills its container width with a tall rectangular
       swatch. Used by the right-sheet color fields where the picker sits on
       its own row and benefits from filling the column. */
    .cp-root-block { display: block; }

    .cp-trigger {
        height: 28px; min-width: 28px;
        padding: 4px;
        border: none; background: transparent; border-radius: 4px;
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .cp-root-block .cp-trigger {
        height: 36px;
        width: 100%;
        padding: 4px;
        display: flex;
    }
    .cp-root-block .cp-swatch-wrap {
        width: 100%;
        height: 100%;
    }
    .cp-root-block .cp-swatch {
        width: 100%;
        height: 100%;
        border-radius: 4px;
    }
    .cp-root-block .cp-swatch-checker {
        border-radius: 4px;
    }
    .cp-trigger:hover {
        background: light-dark(
            color-mix(in oklab, black 8%, transparent),
            color-mix(in oklab, white 10%, transparent)
        );
    }
    .cp-swatch-wrap {
        position: relative;
        display: inline-block;
        line-height: 0;
    }
    .cp-swatch {
        width: 18px; height: 18px;
        border-radius: 3px;
        border: 1px solid light-dark(
            color-mix(in oklab, black 18%, transparent),
            color-mix(in oklab, white 18%, transparent)
        );
        display: block;
    }
    /* Mini checkerboard overlay — matches the canvas convention so the
       swatch reads as "transparent" rather than solid white. */
    .cp-swatch-checker {
        position: absolute;
        inset: 0;
        border-radius: 3px;
        pointer-events: none;
        background:
            conic-gradient(
                light-dark(var(--color-surface-100), var(--color-surface-800)) 25%,
                light-dark(var(--color-surface-300), var(--color-surface-600)) 0 50%,
                light-dark(var(--color-surface-100), var(--color-surface-800)) 0 75%,
                light-dark(var(--color-surface-300), var(--color-surface-600)) 0)
            0 0 / 8px 8px;
    }

    /* Zag's positioner uses inline `z-index: var(--z-index)` which defaults to auto.
       Setting the variable overrides it cleanly (no !important needed). */
    .cp-positioner { --z-index: 1000; }
    .cp-content {
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        border-radius: 6px;
        padding: 10px;
        width: 240px;
        display: flex; flex-direction: column; gap: 10px;
        box-shadow: 0 10px 30px -8px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.25);
    }

    .cp-area {
        position: relative;
        width: 100%; aspect-ratio: 1.6 / 1;
        border-radius: 4px; overflow: hidden;
        touch-action: none;
    }
    /* Zag emits inline `position: relative` on cp-area-bg, which would collapse height
       (the parent uses aspect-ratio — `height: 100%` resolves to 0 with indefinite parent).
       Force absolute + inset:0 to fill the area. */
    .cp-area-bg {
        position: absolute !important;
        inset: 0;
        border-radius: 4px;
    }
    .cp-area-thumb {
        width: 12px; height: 12px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
        pointer-events: none;
    }

    .cp-slider {
        height: 12px;
        border-radius: 999px;
    }
    /* Same dimension-only fix — Zag paints the rainbow inline. */
    .cp-slider-track {
        width: 100%; height: 100%;
        border-radius: 999px;
    }
    .cp-slider-thumb {
        width: 14px; height: 14px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
        pointer-events: none;
    }

    .cp-hex {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
    .cp-hex input {
        flex: 1; min-width: 0;
        height: 24px; padding: 0 6px;
        background: light-dark(white, color-mix(in oklab, white 5%, transparent));
        border: 1px solid light-dark(var(--color-surface-300), color-mix(in oklab, white 12%, transparent));
        border-radius: 3px;
        color: light-dark(var(--color-surface-950), var(--color-surface-50));
        font: 11px var(--font-mono, 'Geist Mono', ui-monospace, monospace);
    }
    .cp-hex input:focus { outline: 1px solid var(--color-primary-500); }
    .cp-fav-add {
        height: 24px; width: 24px;
        padding: 0; border: none;
        background: transparent;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
        border-radius: 3px;
        cursor: pointer; font-size: 14px; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .cp-fav-add:hover {
        color: var(--color-primary-500);
        background: light-dark(var(--color-surface-100), color-mix(in oklab, white 10%, transparent));
    }

    .cp-favs {
        display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
    }
    .cp-fav {
        padding: 0; border: none; background: transparent;
        height: 22px; cursor: pointer;
        border-radius: 3px;
    }
    .cp-fav[data-state="checked"] {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 1px;
    }
    .cp-fav-swatch {
        display: block; width: 100%; height: 100%;
        border-radius: 3px;
        border: 1px solid light-dark(
            color-mix(in oklab, black 18%, transparent),
            color-mix(in oklab, white 18%, transparent)
        );
    }
    /* Checkerboard variant for the "Transparent" tile — same pattern as the
       trigger overlay so the meaning reads consistently. */
    .cp-fav-swatch-transparent {
        background:
            conic-gradient(
                light-dark(var(--color-surface-100), var(--color-surface-800)) 25%,
                light-dark(var(--color-surface-300), var(--color-surface-600)) 0 50%,
                light-dark(var(--color-surface-100), var(--color-surface-800)) 0 75%,
                light-dark(var(--color-surface-300), var(--color-surface-600)) 0)
            0 0 / 8px 8px;
    }
</style>
