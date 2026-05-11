# fitfull

![CI](https://github.com/mdubb86/fitfull/actions/workflows/ci.yml/badge.svg)

Fit text into a given space. Outputs SVG or PNG with text optimally scaled and wrapped to fill the constraint box.

## Features

- **Auto-scaling**: Finds the optimal font size to fill the available space
- **Smart wrapping**: Balanced (even widths) or greedy (fill lines first) modes
- **HTML input**: Pass styled HTML with `<b>`, `<i>`, `<style>` blocks, and inline CSS
- **Mixed styles**: Support for varying font sizes, weights, and families within the same text
- **TTC support**: TrueType Collections work, including macOS system fonts (Helvetica, Arial, etc.)
- **Improved kerning**: GPOS-aware kerning for accurate inter-character spacing
- **Vector output**: SVG with embedded font paths (no font dependencies)
- **Raster output**: PNG using resvg for high-quality rendering

## Documentation

- [docs/architecture.md](./docs/architecture.md) — search algorithm, measurement, rendering pipeline
- [docs/fonts.md](./docs/fonts.md) — how fonts are resolved and loaded
- [docs/development.md](./docs/development.md) — setup, testing, releases, project layout

## Installation

```bash
# As a library
npm install fitfull
# or: pnpm add fitfull

# As a CLI tool
npm install -g fitfull
```

Requires Node.js 20 or later.

A standalone binary (no Node.js required) is available from the [GitHub releases](https://github.com/mdubb86/fitfull/releases). For development setup and building from source, see [docs/development.md](./docs/development.md).

## Library Usage

```typescript
import { fitfull } from 'fitfull';

// Get the singleton (font cache persists across calls)
const ff = fitfull.get();

// Or create a new instance (isolated font cache, can be GC'd)
const ff = fitfull.create();
```

### Plain text

```typescript
const result = await ff.fit({
  text: 'Hello World',
  font: 'Helvetica',
  width: 400,
  height: 100,
  align: 'center',
  wrap: 'balanced',
});

console.log(result.svg);           // SVG string with embedded font paths
console.log(result.width);         // tight bounding box width
console.log(result.height);        // tight bounding box height
console.log(result.maxTextHeight); // height of tallest token
console.log(result.lines);         // ["Hello", "World"]
```

### HTML

HTML must be self-styled with `font-family` and `font-size` on the body or all elements:

```typescript
const result = await ff.fit({
  html: `<body style="font-family: Helvetica; font-size: 16px">
    <b>Bold</b> and <i>italic</i> text
  </body>`,
  width: 400,
  height: 100,
});
```

### Tokens

For full control, pass pre-built tokens with per-word font and size:

```typescript
const result = await ff.fit({
  tokens: [
    { text: 'Hello', size: 18, font: 'inter', weight: 'bold' },
    { text: ' ', size: 18, font: 'inter', weight: 'regular' },
    { text: 'World', size: 36, font: 'inter', weight: 'regular' },
  ],
  width: 400,
  height: 100,
});
```

### Options

All input modes accept these fitting options:

```typescript
{
  width: 400,              // required
  height: 100,             // required
  textHeight?: 48,         // fixed text height (disables scale optimization)
  maxTextHeight?: 60,      // cap text height
  minLines?: 1,
  maxLines?: 4,
  lineSpacing?: 1.0,
  align?: 'left',          // 'left' | 'center' | 'right'
  wrap?: 'balanced',       // 'balanced' | 'greedy'
  fonts?: string[],        // explicit font file paths (skips system scan when covered)
  maxTokens?: 1000,        // input token cap (default 1000; pass Infinity to disable)
  timeout?: 10000,         // fit deadline in ms (default 10000; pass Infinity to disable)
  color?: '#000000',
  background?: 'white',
}
```

See [docs/fonts.md](./docs/fonts.md) for how `fonts` and font resolution work.

## CLI Usage

```bash
# Auto-scale to fill the box
fitfull --text "Hello World" --size 400x100 --font Arial -o output.png

# Fixed text height (consistent sizing across outputs)
fitfull --text "Hello World" --size 400x100 --font Arial --text-height 48 -o output.png

# Maximum text height (optimize but cap at limit)
fitfull --text "Hello World" --size 400x100 --font Arial --max-text-height 60 -o output.png

# Greedy wrapping (fill lines before wrapping)
fitfull --text "Long text here..." --size 400x200 --font Arial --wrap greedy -o output.png

# With line constraints
fitfull --text "Hello World" --size 400x100 --font Arial --max-lines 2 -o output.png

# System font
fitfull --text "Hello World" --size 400x100 --font "Helvetica Bold" -o output.png

# Token mode (mixed styles)
fitfull --tokens tokens.json --size 400x100 --font ./Inter-Regular.ttf --font ./Inter-Bold.ttf -o output.png

# HTML mode (must be self-styled with font-family and font-size)
fitfull --html input.html --size 400x200 -o output.png

# HTML from stdin
echo '<body style="font-family: Arial; font-size: 16px"><b>Hello</b> <i>World</i></body>' | fitfull --html - --size 400x100 -o output.png

# HTML with style blocks
cat <<'EOF' | fitfull --html - --size 600x200 -o output.png
<style>
  body { font-family: Verdana; font-size: 12px; }
  .title { font-size: 24px; font-weight: bold; }
</style>
<span class="title">Heading:</span> body text here
EOF
```

### Token Format

For mixed styles, provide a JSON array of tokens:

```json
[
  { "text": "Hello", "size": 18, "font": "Inter Bold" },
  { "text": " ", "size": 18, "font": "Inter" },
  { "text": "World", "size": 36, "font": "Inter" }
]
```

Token sizes are **relative** - their ratios are preserved while scaling. Use `--text-height` with the `maxTextHeight` output value to reproduce the same rendering.

### HTML Format

HTML must have explicit `font-family` and `font-size` styling. Set defaults on the `<body>` element:

```html
<body style="font-family: Arial; font-size: 16px">
  <b>Bold</b> and <i>italic</i> text
</body>
```

CSS in `<style>` blocks is inlined automatically:

```html
<style>
  body { font-family: Arial; font-size: 16px; }
  .title { font-size: 24px; font-weight: bold; }
</style>
<span class="title">Sale:</span> Everything must go!
```

Supported tags: `<b>`/`<strong>`, `<i>`/`<em>`, `<br>`, `<span>`, `<div>`, `<p>`

Supported CSS: `font-size` (px, pt, em, %), `font-weight`, `font-family`, `font-style`

Font sizes are relative and scale proportionally, just like token sizes.

## CLI Reference

| Option | Description |
|--------|-------------|
| `--size <WxH>` | **Required**. Target dimensions (e.g., 400x100) |
| `--text <string>` | Text to render (simple mode) |
| `--tokens <file>` | JSON token file, or - for stdin (token mode) |
| `--html <file>` | HTML file, or - for stdin (HTML mode) |
| `--font <file>` | Font file or "Family Weight" (repeatable, required for text/token modes) |
| `-o, --output <file>` | Output file path (default: output.png) |
| `--text-height <n>` | Fixed height for largest text in pixels (disables scale optimization) |
| `--max-text-height <n>` | Maximum height for any text in pixels (constrains optimization) |
| `--lines <n>` | Use exact line count (omit to auto-compute) |
| `--min-lines <n>` | Minimum lines (for auto mode) |
| `--max-lines <n>` | Maximum lines (for auto mode) |
| `--line-spacing <n>` | Line spacing multiplier (default: 1) |
| `-a, --align <align>` | Horizontal alignment: left, center, right |
| `-w, --wrap <mode>` | Line wrapping: balanced or greedy |
| `--max-tokens <n>` | Maximum input tokens (default: 1000) |
| `--timeout <ms>` | Fit deadline in milliseconds (default: 10000) |
| `-c, --color <color>` | Text color (default: #000000) |
| `-b, --background <color>` | Background color (default: transparent) |

### Option Conflicts

- `--text-height` cannot be used with `--max-text-height`
- `--lines` cannot be used with `--min-lines` or `--max-lines`

## Output

The CLI outputs JSON with fit results:

```json
{
  "width": 400,
  "height": 54,
  "minTextHeight": 48.5,
  "maxTextHeight": 48.5,
  "lines": ["Hello", "World"],
  "output": "output.png",
  "elapsed": 12,
  "arrangements": 3
}
```

| Field | Description |
|-------|-------------|
| `width` | Actual width of rendered output (tight bounding box) |
| `height` | Actual height of rendered output (tight bounding box) |
| `minTextHeight` | Height of the smallest token in pixels |
| `maxTextHeight` | Height of the tallest token in pixels |
| `lines` | Array of text lines in the final layout |
| `output` | Output file path |
| `elapsed` | Processing time in milliseconds |
| `arrangements` | Number of line arrangements evaluated |

## Wrapping Modes

### Balanced (default)

Tries to make all lines similar width. Good for headlines and titles.

```
"Weapon Expo:"
"take a peek at weapons"
"throughout the ages. From medieval"
"maces to futuristic laser guns."
```

### Greedy

Fills lines before wrapping, like normal paragraph text. Last line is typically shorter.

```
"Weapon Expo: take a peek at"
"weapons throughout the ages. From"
"medieval maces to futuristic laser"
"guns."
```

For an explanation of how the search picks an arrangement and scale, see [docs/architecture.md](./docs/architecture.md).

## Known Limitations

- **`.dfont`, `.woff`, `.woff2` are not supported** — only `.ttf`, `.otf`, and `.ttc` work.

## License

MIT
