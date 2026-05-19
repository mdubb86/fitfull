<script lang="ts">
    import { box } from '$lib/state/box.svelte';
    import { fit } from '$lib/fitfull/fit.svelte';

    // fitfull returns floats with full precision; round for display so the
    // bar doesn't blow out to "291.12855740922464" on narrow viewports.
    const textW = $derived(Math.round(fit.result?.textWidth ?? 0));
    const textH = $derived(Math.round(fit.result?.textHeight ?? 0));
    const duration = $derived(fit.durationMs);
    // Use fitBoxW/H (snapshotted at fit time) — not live box.width/height,
    // which change while dragging before fitfull re-runs and would produce a
    // jittery ratio against stale text dims.
    const occupancy = $derived.by(() => {
        if (!fit.result) return 0;
        const area = fit.fitBoxW * fit.fitBoxH;
        if (area === 0) return 0;
        return Math.round((fit.result.textWidth * fit.result.textHeight) / area * 100);
    });
</script>

<div class="stats-bar">
    <div class="metrics">
        <span class="grp"><span class="lbl">box</span> <b><span class="num dim">{box.width}</span> × <span class="num dim">{box.height}</span></b></span>
        <span class="grp"><span class="lbl">aspect</span> <b><span class="num ratio">{box.aspect.toFixed(2)}</span> : 1</b></span>
        <span class="grp"><span class="lbl">text</span> <b><span class="num dim">{textW}</span> × <span class="num dim">{textH}</span></b></span>
        <span class="grp"><span class="lbl">occupancy</span> <b><span class="num pct">{occupancy}</span>%</b></span>
        <span class="grp"><span class="lbl">duration</span> <b><span class="num dur">{duration}</span>ms</b></span>
    </div>
</div>

<style>
    .stats-bar {
        display: flex; align-items: center;
        padding: 0 18px;
        min-height: 48px;
        background: light-dark(var(--color-surface-50), var(--color-surface-950));
        border-top: 1px solid light-dark(var(--color-surface-200), var(--color-surface-800));
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        min-width: 0;
    }

    .metrics {
        flex: 1; min-width: 0;
        display: flex; align-items: center; justify-content: center;
        gap: 18px;
        overflow-x: auto;
        scrollbar-width: thin;
    }
    .metrics::-webkit-scrollbar { height: 4px; }
    .metrics::-webkit-scrollbar-thumb {
        background: light-dark(var(--color-surface-300), var(--color-surface-700));
        border-radius: 999px;
    }
    .metrics::-webkit-scrollbar-track { background: transparent; }

    /* Mobile: wrap to multiple rows instead of horizontal scroll. */
    @media (max-width: 600px) {
        .stats-bar { padding: 8px 14px; }
        .metrics {
            flex-wrap: wrap;
            justify-content: center;
            row-gap: 6px;
            column-gap: 14px;
            overflow-x: visible;
        }
    }

    .grp {
        display: flex; align-items: center; gap: 6px;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .grp .lbl { color: inherit; }
    .grp b {
        color: light-dark(var(--color-surface-950), var(--color-surface-100));
        font-weight: 500;
        /* Equal-width digits + fixed slots per metric so values changing length
           don't push neighboring labels around. */
        font-variant-numeric: tabular-nums;
        display: inline-block;
        text-align: left;
    }
    /* Each number occupies a min-width slot — surrounding text (separators, units,
       neighboring groups) doesn't move when digit count changes. */
    .num {
        display: inline-block;
        text-align: left;
    }
    .num.dim   { min-width: 4ch; }  /* fits "9999" */
    .num.ratio { min-width: 5ch; }  /* fits "99.99" — 99:1 aspect is already extreme */
    .num.pct   { min-width: 3ch; }  /* fits "100" */
    .num.dur   { min-width: 4ch; }  /* fits "9999" */

    /* Width (first dim number) right-aligned so " × height" stays glued to it.
       Height stays left-aligned so trailing slot space sits at group's right edge. */
    .num.dim:first-child { text-align: right; }
    /* Right-aligned so the trailing " : 1" / "%" / "ms" stays anchored
       to the value as the digit count changes. */
    .num.ratio, .num.pct, .num.dur { text-align: right; }
</style>
