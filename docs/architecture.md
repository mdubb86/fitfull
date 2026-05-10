# Architecture

This document describes how fitfull turns a piece of styled text into an SVG (or PNG) that fills a target box. It is aimed at curious users and contributors — the high-level overview lives in the README.

## Pipeline

```
Input (text | tokens | html)
        ↓
   Token list (text + size + font + weight)
        ↓
   FontManager loads required fonts
        ↓
   Pre-measure: TokenMetrics at scale=1
        ↓
   Fitter: pick arrangement + scale (balanced or greedy)
        ↓
   measureLine: build glyph paths for the winning arrangement
        ↓
   computeLayout: position lines, apply alignment
        ↓
   layoutToSVG: emit SVG with embedded paths
        ↓
   (optional) resvg-wasm: rasterize to PNG
```

The key idea is that the search loop never touches glyph paths. Each token is measured exactly once at scale=1, and the search compares arrangements purely with scalar arithmetic on those metrics. Only the winning arrangement gets rendered.

## Token measurement

Before the search starts, `measureAllTokenMetrics` walks the token list once. For every token it captures:

- `advanceWidth` — sum of glyph advances at scale=1, including intra-token kerning
- `leftBearing`, `tightRight` — visual horizontal bounds (from glyph bboxes)
- `tightTop`, `tightBottom` — visual vertical bounds relative to baseline
- `ascent`, `descent` — font metrics for line spacing

A second pass adds `kerningDelta` to each token: the kern between the last char of token *i* and the first char of token *i+1*, only when both share the same font and weight. This gives O(1) line-width computation: any line is `sum(advanceWidth + kerningDelta) + lastToken.tightRight - firstToken.leftBearing`.

Because every quantity is linear in font size, the same metrics work for any scale `s`: just multiply.

See `src/measure/metrics.ts` for the full implementation.

## Fitter strategies

The fitter picks an arrangement (which tokens go on which line) and a scale (how big the text is). There are two strategies, selected by the `wrap` option.

### Balanced strategy

`src/fitter/balanced.ts`

Goal: produce lines of roughly equal width — good for headlines and titles.

1. **Enumerate arrangements.** For each line count `N` in `[minLines, maxLines]`, compute the *ideal* break points (the indices where cumulative width is closest to `k/N` of the total) and explore a window around each. The window size is chosen so the total combinations stay under a budget (`MAX_ARRANGEMENTS_PER_LINE_COUNT = 100,000`).
2. **Trim whitespace.** Leading and trailing whitespace tokens are stripped from each line.
3. **Score each arrangement analytically.** For an arrangement with max line width `W` and total height `H` at scale=1, the optimal scale is `min(width/W, height/H)`, clamped to `[minScale, maxScale]` and (if set) to `maxTextHeight / tallestLine.height`.
4. **Compare.** An arrangement is better than the current best if its scale is larger; ties break on `min(lineWidths)` (we prefer arrangements where no line is much shorter than the others).

Because the scale is computed analytically per arrangement, there is no inner search loop.

### Greedy strategy

`src/fitter/greedy.ts`

Goal: fill each line before wrapping — good for paragraph-like body text.

The greedy *arrangement* is a function of one parameter: the wrap width in scale=1 units, which equals `constraintWidth / scale`. So the search is over scale alone.

1. **Binary search over scale** in `[minScale, maxScale]` to ~`SEARCH_PRECISION`. At each midpoint:
   - Build the greedy arrangement for that scale.
   - Check it fits the box and respects line-count and `maxTextHeight` constraints.
   - If it fits or has too few lines (text fits too easily), raise the lower bound; otherwise lower the upper bound.
2. **Linear probe above the binary-search result.** Greedy wrapping is non-monotone near wrap-count boundaries: a slightly larger scale can change which token wraps and end up fitting again. The probe samples 10 evenly spaced scales between the binary-search winner and `maxScale` to catch these cases.
3. **Score.** The best fit is the largest scale that satisfies all constraints; ties break on the last-line ratio (avoiding an awkward short last line).

### Scale bounds

Both strategies receive the same scale envelope from `Fitter.computeBestFit`:

- `textHeight` set: `minScale = maxScale = textHeight / tallestTokenTightHeight`. The search degenerates to scoring arrangements at one fixed scale.
- Auto-scale: `minScale = 1 / smallestTokenSize` (smallest token at least 1px), `maxScale = 1.5 * boxHeight / largestTokenSize`. The 1.5× headroom lets a single-line layout be height-bound instead of width-bound when appropriate.

The constructor also estimates a default `maxLines` from the text "ribbon" length and box aspect ratio: `N* = sqrt(totalAdvanceWidth * boxHeight / (boxWidth * lineHeight))`, capped at `2 * N*`.

## Layout

Once an arrangement and scale are chosen, the winning lines are remeasured at the final scale (`measureLine`), this time generating actual glyph paths and bounding boxes via `opentype.js`. Then `computeLayout` (in `src/measure/layout.ts`) does two things:

1. **Vertical positioning.** Each line is placed at the baseline of the previous line plus `(prevLine.ascent - prevLine.descent) * lineSpacing`. The first line's `yOffset` is 0; the layout is then translated so the visual top edge sits at y=0.
2. **Horizontal alignment.** Each line is shifted so its visual left edge sits at x=0, then nudged right by `(maxWidth - lineWidth)` × `{0, 0.5, 1}` for `left`, `center`, `right`.

The output `PositionedLayout` carries tight bounding-box dimensions plus per-line `(x, y, baseline)` positions, which is what the renderer consumes.

## Rendering

### SVG

`layoutToSVG` (`src/measure/render.ts`) walks the positioned layout and emits one `<g>` + `<path>` per token. The path data comes from `opentype.js`'s `toPathData(2)`, which produces SVG path commands with two decimal places. Because the glyph outlines are embedded as paths, the resulting SVG renders identically anywhere — no font dependency, no `@font-face`, no fallback risk.

If `annotate: true` is set, a second pass adds debug overlays: green rectangles around line tight bboxes, blue rectangles around individual token bboxes, and red dashed baselines with baseline-to-baseline distance labels.

### PNG

The CLI uses [`@resvg/resvg-wasm`](https://github.com/yisibl/resvg-js) to rasterize the SVG. Because resvg ships as a WASM module, it works the same on macOS, Linux, and Windows without native dependencies.

The library always returns SVG; rasterization is purely a CLI concern.

## File map

| Path | Role |
|------|------|
| `src/fitfull.ts` | High-level `Fitfull` class; the public entry point |
| `src/cli.ts` | Command-line interface |
| `src/html-to-tokens.ts` | HTML → token conversion (DOM walk, CSS inlining) |
| `src/fitter/fitter.ts` | Driver: builds search context, dispatches to strategy |
| `src/fitter/balanced.ts` | Balanced search: enumerate arrangements, analytic scale |
| `src/fitter/greedy.ts` | Greedy search: binary search + linear probe |
| `src/fitter/wrapping.ts` | Arrangement generators; greedy line filler |
| `src/measure/metrics.ts` | Pre-computation: `TokenMetrics`, `LineMetrics`, advance/tight bounds |
| `src/measure/measure.ts` | Path-generating measurement (final pass) |
| `src/measure/layout.ts` | Vertical + horizontal positioning |
| `src/measure/render.ts` | SVG emission |
| `src/fonts/font-manager.ts` | Font resolution and loading (see [fonts.md](./fonts.md)) |
