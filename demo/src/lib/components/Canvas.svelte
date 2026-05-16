<script lang="ts">
    import { box } from '$lib/state/box.svelte';

    let canvasEl: HTMLDivElement;

    /** Visual scale: visual W = logical W * displayScale. */
    let displayScale = $state(1);
    /** Drag state — captured at mousedown, prevents in-drag zoom-in. */
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

    function startDrag(e: MouseEvent, dir: string) {
        e.preventDefault();
        const startScale = displayScale;
        dragStartScale = startScale;
        isDragging = true;
        const sx = e.clientX, sy = e.clientY;
        const sw = box.width, sh = box.height;
        const shift = e.shiftKey;
        const target = e.currentTarget as HTMLDivElement;
        target.classList.add('active');

        function move(ev: MouseEvent) {
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
        function up() {
            target.classList.remove('active');
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            isDragging = false;
            recomputeScale();  // snap — lifts the dragStartScale cap, animates via CSS transition
        }
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    const handleDirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
</script>

<section class="preview">
    <div class="canvas" bind:this={canvasEl}>
        <div class="fit-card">
            <div class="fitbox"
                 style:width="{box.width * displayScale}px"
                 style:height="{box.height * displayScale}px">
                <span class="placeholder">no fit yet</span>
            </div>
            {#each handleDirs as dir}
                <div class="handle handle-{dir}"
                     onmousedown={(e) => startDrag(e, dir)}
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
        background:
            linear-gradient(to bottom right,
                color-mix(in oklab, var(--color-brand) 5%, transparent),
                transparent 40%),
            light-dark(var(--color-surface-50), var(--color-surface-900));
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
