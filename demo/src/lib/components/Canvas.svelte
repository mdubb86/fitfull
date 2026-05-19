<script lang="ts">
    import { box } from '$lib/state/box.svelte';
    import { fit } from '$lib/fitfull/fit.svelte';

    let canvasEl: HTMLDivElement;

    /** Visual scale: visual W = logical W * displayScale. */
    let displayScale = $state(1);
    /** Drag state — captured at pointerdown, prevents in-drag zoom-in. */
    let isDragging = $state(false);
    let dragStartScale = 1;

    const MAX_SCALE = 4;

    function recomputeScale() {
        if (!canvasEl) return;
        const margin = 40;
        const cw = canvasEl.clientWidth  - 112 - margin * 2;
        const ch = canvasEl.clientHeight - 112 - margin * 2 - 40;  // 40 for hint band
        let fit = Math.min(cw / box.width, ch / (box.height + 60), MAX_SCALE);
        if (isDragging) fit = Math.min(fit, dragStartScale);
        if (!isFinite(fit) || fit <= 0) fit = 0.05;
        displayScale = fit;
    }

    $effect(() => {
        // Re-run on box dim changes
        box.width; box.height;
        recomputeScale();
    });

    $effect(() => {
        if (!canvasEl) return;
        const ro = new ResizeObserver(recomputeScale);
        ro.observe(canvasEl);
        return () => ro.disconnect();
    });

    function startDrag(e: PointerEvent, dir: string) {
        e.preventDefault();
        const startScale = displayScale;
        dragStartScale = startScale;
        isDragging = true;
        const sx = e.clientX, sy = e.clientY;
        const sw = box.width, sh = box.height;
        const shift = e.shiftKey;
        const pointerId = e.pointerId;
        const target = e.currentTarget as HTMLDivElement;
        target.classList.add('active');
        // Capture the pointer so move/up keep tracking even if the finger/cursor
        // leaves the small handle hit-target (essential on touch where the
        // finger easily strays off the 12px handle).
        try { target.setPointerCapture(pointerId); } catch {}

        function move(ev: PointerEvent) {
            if (ev.pointerId !== pointerId) return;
            if (fit.state !== 'resizing') fit.state = 'resizing';
            // dx/dy in LOGICAL pixels — divided by startScale (NOT live scale,
            // which changes during drag and would compound into runaway).
            const dx = (ev.clientX - sx) / startScale;
            const dy = (ev.clientY - sy) / startScale;
            // Center-anchored: doubled. Dragged edge tracks cursor 1:1; opposite mirrors.
            let nw = sw, nh = sh;
            if (dir.includes('e')) nw = sw + dx * 2;
            if (dir.includes('w')) nw = sw - dx * 2;
            if (dir.includes('s')) nh = sh + dy * 2;
            if (dir.includes('n')) nh = sh - dy * 2;
            if (shift) {
                const ratio = sw / sh;
                if (Math.abs(dx) > Math.abs(dy)) nh = nw / ratio;
                else nw = nh * ratio;
            }
            box.setDims(nw, nh);
        }
        function up(ev: PointerEvent) {
            if (ev.pointerId !== pointerId) return;
            target.classList.remove('active');
            try { target.releasePointerCapture(pointerId); } catch {}
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            isDragging = false;
            recomputeScale();  // snap — lifts the dragStartScale cap, animates via CSS transition
            fit.scheduleFit(0);  // commit on release, no debounce
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
    }

    const handleDirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

    $effect(() => {
        // Re-fit whenever box dims change via input (typing), OR on initial mount.
        // Drag-triggered fits go through scheduleFit() in the drag handler.
        box.width; box.height; box.wrap; box.align; box.lineSpacing;
        if (!isDragging) fit.scheduleFit(150);
    });

    /**
     * fitfull returns SVG at the text's tight bbox (e.g. 291×140). We display
     * the SVG inside a box-sized container, scaled to displayScale. The viewBox
     * + preserveAspectRatio combo positions the text within the box per the
     * user's align choice: left = xMinYMid, center = xMidYMid, right = xMaxYMid.
     * Vertical stays center (fitfull has no vertical align concept).
     */
    function scaleSvg(svg: string, scale: number): string {
        const visualW = box.width * scale;
        const visualH = box.height * scale;
        const par = box.align === 'left'  ? 'xMinYMid meet'
                  : box.align === 'right' ? 'xMaxYMid meet'
                  : 'xMidYMid meet';
        let out = svg
            .replace(/width="[^"]*"/, `width="${visualW}"`)
            .replace(/height="[^"]*"/, `height="${visualH}"`);
        if (out.match(/preserveAspectRatio="[^"]*"/)) {
            out = out.replace(/preserveAspectRatio="[^"]*"/, `preserveAspectRatio="${par}"`);
        } else {
            out = out.replace(/<svg/, `<svg preserveAspectRatio="${par}"`);
        }
        return out;
    }
</script>

<section class="preview">
    <div class="canvas" bind:this={canvasEl}>
        <div class="fit-card">
            <div class="fitbox"
                 class:no-transition={isDragging}
                 style:width="{box.width * displayScale}px"
                 style:height="{box.height * displayScale}px">
                {#if fit.result}
                    {@html scaleSvg(fit.result.svg, displayScale)}
                {:else}
                    <span class="placeholder">no fit yet</span>
                {/if}
            </div>
            {#each handleDirs as dir}
                <div class="handle handle-{dir}"
                     onpointerdown={(e) => startDrag(e, dir)}
                     role="button"
                     tabindex="-1"
                     aria-label="Resize {dir}"></div>
            {/each}
        </div>
        <div class="hint">
            <span>Resize with handles or specify exact dimensions →</span>
        </div>
    </div>
</section>

<style>
    .preview {
        position: relative;
        background:
            radial-gradient(circle at 1px 1px,
                            light-dark(var(--color-surface-300), var(--color-surface-800)) 1px,
                            transparent 0) 0 0/24px 24px,
            light-dark(var(--color-surface-100), var(--color-surface-950));
        background-position: center center;
        min-height: 0;
        overflow: hidden;
    }
    .canvas {
        position: relative;
        overflow: hidden;
        height: 100%;
        padding: 56px;
    }
    .fit-card {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        /* fit-card is content-sized to fitbox; handles position relative to it */
    }
    .fitbox {
        position: relative;
        border-radius: 0.375rem;
        /* Checkerboard pattern indicates transparent areas in the export
           (Figma/Photoshop convention). Any background color the user picks
           is baked into the SVG by fitfull, covering the checkerboard. */
        --cb-a: light-dark(var(--color-surface-100), var(--color-surface-800));
        --cb-b: light-dark(var(--color-surface-200), var(--color-surface-700));
        background:
            conic-gradient(var(--cb-a) 25%, var(--cb-b) 0 50%, var(--cb-a) 0 75%, var(--cb-b) 0)
            0 0 / 16px 16px;
        border: 1px solid light-dark(var(--color-surface-300), var(--color-surface-700));
        box-shadow:
            inset 0 0 0 1px color-mix(in oklab, var(--color-brand) 8%, transparent),
            0 24px 60px -30px color-mix(in oklab, var(--color-brand) 22%, transparent);
        display: grid;
        place-items: center;
        user-select: none;
        overflow: hidden;
        transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1),
                    height 240ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    /* During drag, kill the CSS transition so the box tracks the cursor
       in real-time instead of lagging by 240ms. Re-enabled on mouseup so
       the snap-to-fit animation runs. */
    .fitbox.no-transition {
        transition: none;
    }
    .placeholder {
        color: light-dark(var(--color-surface-400), var(--color-surface-600));
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
    }

    /* 8 drag handles — SIBLINGS of fitbox (NOT children) so fitbox overflow:hidden
       doesn't clip them. Positioned relative to fit-card (which is content-sized to box). */
    .handle {
        position: absolute;
        width: 10px; height: 10px;
        background: light-dark(white, var(--color-surface-950));
        border: 1.5px solid var(--color-brand);
        border-radius: 2px;
        z-index: 5;
        /* Prevent the browser from interpreting touch drags as scroll/zoom
           while resizing on mobile. Pointer events handle the gesture. */
        touch-action: none;
    }
    /* On touch screens the 10px handle is too small to hit reliably. Expand
       the hit area without changing the visual size via a transparent pad. */
    @media (pointer: coarse) {
        .handle::after {
            content: '';
            position: absolute;
            inset: -10px;
        }
    }
    .handle:hover {
        box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-brand) 25%, transparent);
    }
    .handle.active {
        background: var(--color-brand);
    }

    .handle-nw { top: 0;       left: 0;     transform: translate(-50%, -50%); cursor: nwse-resize; }
    .handle-n  { top: 0;       left: 50%;   transform: translate(-50%, -50%); cursor: ns-resize;   }
    .handle-ne { top: 0;       right: 0;    transform: translate( 50%, -50%); cursor: nesw-resize; }
    .handle-e  { top: 50%;     right: 0;    transform: translate( 50%, -50%); cursor: ew-resize;   }
    .handle-se { bottom: 0;    right: 0;    transform: translate( 50%,  50%); cursor: nwse-resize; }
    .handle-s  { bottom: 0;    left: 50%;   transform: translate(-50%,  50%); cursor: ns-resize;   }
    .handle-sw { bottom: 0;    left: 0;     transform: translate(-50%,  50%); cursor: nesw-resize; }
    .handle-w  { top: 50%;     left: 0;     transform: translate(-50%, -50%); cursor: ew-resize;   }

    .hint {
        position: absolute;
        bottom: 14px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Geist Mono', monospace;
        font-size: 10.5px;
        color: light-dark(var(--color-surface-500), var(--color-surface-500));
        pointer-events: none;
        white-space: nowrap;
    }
</style>
