# Fonts

fitfull resolves fonts through three layers, from cheapest to most expensive. Each layer only runs if the previous one couldn't satisfy a request, so explicit paths bypass system scanning entirely.

The implementation lives in `src/fonts/font-manager.ts`.

## Resolution layers

### Layer 1: Explicit font files

The fastest and most predictable path: pass the font files you actually want.

**CLI:** repeat `--font` for each file or family name.

```bash
fitfull --text "Hello" --size 400x100 --font ./fonts/Inter-Regular.ttf -o out.png
fitfull --tokens tokens.json --size 400x100 \
        --font ./fonts/Inter-Regular.ttf \
        --font ./fonts/Inter-Bold.ttf \
        -o out.png
```

**Library:** pass `fonts: string[]` on the fit options.

```typescript
await ff.fit({
  tokens,
  width: 400,
  height: 100,
  fonts: ['./fonts/Inter-Regular.ttf', './fonts/Inter-Bold.ttf'],
});
```

Each file is loaded once and registered under the family + subfamily declared in its name table. If a token's family/weight resolves to one of these, no system scanning happens.

### Layer 2: System index lookup

If a token references a family that hasn't been registered explicitly, fitfull builds a per-instance index of installed fonts. It walks every font on the system using [`get-system-fonts`](https://www.npmjs.com/package/get-system-fonts), parses the name table, and indexes each one by:

- **Primary:** preferred family (Name ID 16) — what CSS `font-family` matches
- **Secondary:** font family (Name ID 1) — the internal family name

Both maps key by lowercased family, with subfamily (e.g. `regular`, `bold`, `italic`) as the inner key.

The index is built lazily and cached for the lifetime of the `Fitfull` instance, so subsequent fits are fast.

### Layer 3: Fuzzy filename fallback

If the family isn't found in the index (e.g. the font has a non-standard name table), fitfull falls back to fuzzy matching. It uses [`fuzzysort`](https://www.npmjs.com/package/fuzzysort) to rank file names against the requested family, loads the top 10 candidates, and returns the first one whose internal family name actually matches. If none match, it scans the rest of the system.

This layer is the slowest of the three but gives a chance to recover from naming inconsistencies.

## The "Scanned N system fonts" warning

When Layer 2 or 3 ends up resolving a font, fitfull writes a one-time hint to stderr:

```
[fitfull] Scanned 312 system fonts to resolve 1 family (84.2ms). Add these to skip next time:
  --font /System/Library/Fonts/Helvetica.ttc
```

(Library callers see a `fonts: ["..."]` snippet instead of `--font` lines.)

This is informational, not an error: the fit succeeded. The message tells you which file was actually used and shows the exact incantation that would skip the system scan next time. If you copy those paths into `--font` flags or the `fonts: []` option, layer 2 + 3 are bypassed entirely on subsequent runs.

To silence the warning, ensure all required families are covered by Layer 1.

## How families are matched

### Token mode

Each token has a `font` field (the family) and a `weight` field. Resolution looks up the family in the loaded font map (after normalization), then picks the file whose subfamily best matches the weight. Subfamily aliases recognized:

- `regular`: `regular`, `normal`, `book`, `roman`
- `bold`: `bold`, `heavy`, `black`
- `italic`: `italic`, `oblique`
- `bolditalic`: `bold italic`, `bolditalic`, `bold oblique`

If the family is found but the requested weight isn't, fitfull throws with the list of available subfamilies.

### Text mode (`--font`)

The CLI's `--font` accepts either:

- A file path (e.g. `./fonts/Inter-Bold.ttf`) — the file is loaded directly and its declared family + subfamily are used.
- A family name with optional weight (e.g. `"Helvetica"`, `"Helvetica Bold"`, `"Inter Bold Italic"`) — the family is resolved through Layers 2/3.

When a name is given, the CLI parses the trailing weight tokens (`bold`, `italic`, etc.) off the family string before resolution.

### HTML mode

`font-family` from CSS (whether inline `style=""` or in `<style>` blocks) is used as the family name; `font-weight` and `font-style` together produce the requested weight (`regular`, `bold`, `italic`, `bolditalic`). The same Layer 1/2/3 resolution applies. CSS in `<style>` blocks is inlined onto matching elements before walking the DOM, so the resolution is identical to inline-styled HTML.

## Bundled test fixtures

The repo ships with Inter Regular and Inter Bold under `fonts/` so tests can run without depending on system fonts:

- `fonts/Inter-Regular.ttf`
- `fonts/Inter-Bold.ttf`
- `fonts/OFL.txt` — SIL Open Font License 1.1 (the license Inter is distributed under)

Source: <https://github.com/rsms/inter>. These files are test fixtures only; they are not bundled into the published package.
