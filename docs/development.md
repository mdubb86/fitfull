# Development

## Prerequisites

- **Node.js 24 LTS** — the version pinned in `.nvmrc`. Earlier versions may work (the package declares `engines.node >= 20`), but CI runs on 24.
- **pnpm 11** — declared in `package.json` `packageManager`.

If you use [`nvm`](https://github.com/nvm-sh/nvm), `nvm use` will pick up `.nvmrc`. If you don't have pnpm, `npm install -g pnpm@11` works, or use [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

`pnpm build` runs `tsc` and emits compiled JS into `dist/`. The test runner (`node --test`) executes against the compiled output, so a build is required before the first run and after any source changes.

## Test commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests against the latest `dist/` build |
| `pnpm test:update` | Re-run tests with `UPDATE_SNAPSHOTS=1`; rewrites snapshot files in place |

### Snapshot workflow

SVG output for representative scenarios is locked in `src/__snapshots__/`. The snapshots are plain `.svg` files, so diffs are reviewable directly.

When you make an intentional rendering change:

1. Run `pnpm test`. Failing snapshots will print a diff and which file differed.
2. Inspect the affected `.svg` files — open them in a browser or any SVG-capable viewer if you want to see the visual change.
3. If the new output is correct, run `pnpm test:update` to overwrite the snapshots.
4. Commit the updated `.svg` files together with the source change so reviewers can see both.

If a snapshot diff is unexpected, that's a bug — don't update the snapshot, fix the code.

## Building

| Command | Output |
|---------|--------|
| `pnpm build` | Compiled JS + `.d.ts` files in `dist/` (the published package) |
| `pnpm build:bin` | Compiles, then runs `bun build --compile` to produce a standalone `fitfull` binary in the repo root |

The standalone binary requires [Bun](https://bun.sh/) to build but runs without any runtime dependency.

## Releases

The release flow is:

1. Bump `version` in `package.json` and commit it on `main`.
2. Run `pnpm release:github` — tags `v<version>` and pushes the tag.
3. The `Release` workflow (`.github/workflows/release.yml`) takes over: installs, builds, runs tests, then **pauses for manual approval** at the `release` GitHub Environment gate.
4. After approval it publishes to npm (with [provenance](https://docs.npmjs.com/generating-provenance-statements)) via OIDC trusted publishing — no npm token is stored anywhere.
5. It then compiles standalone Bun binaries for Linux / macOS (arm64 + x64) / Windows and attaches them to a generated GitHub release.

`pnpm release:github` lives in `scripts/tag-release.js` and refuses to run with a dirty working tree or an existing tag.

| Command | What it does |
|---------|--------------|
| `pnpm release:github` | Tags `v<version>` and pushes — triggers the Release workflow |
| `pnpm release:npm` | Manual escape hatch: builds and runs `pnpm publish --access public`. Requires a local npm token; only use if Actions is broken. |

CI (`.github/workflows/ci.yml`) runs `pnpm build` and `pnpm test` on every push and PR — separate from the release pipeline.

### One-time setup on npmjs.com

Before the first release works, configure a trusted publisher for the `fitfull` package:

- npmjs.com → account settings → Trusted Publishers → Add Pending Publisher
- Package: `fitfull`, Publisher: GitHub Actions, Repo owner: `mdubb86`, Repo: `fitfull`, Workflow: `release.yml`, Environment: *(leave blank)*

And on github.com → repo Settings → Environments → New environment `release` → add the owner as a required reviewer. This is what gates the publish step on a manual click.

## Project structure

```
src/
  fitfull.ts            High-level Fitfull class (public API)
  cli.ts                Command-line entry point
  html-to-tokens.ts     HTML → token conversion
  schema.ts             Token JSON schema (zod)
  types.ts              Shared types

  fitter/               Search algorithm
    fitter.ts           Main driver
    balanced.ts         Balanced strategy
    greedy.ts           Greedy strategy (binary search + probe)
    wrapping.ts         Arrangement generation, line wrapping

  measure/              Measurement and rendering
    metrics.ts          Pre-computation at scale=1
    measure.ts          Full measurement (path generation)
    layout.ts           Line positioning, alignment
    render.ts           SVG emission

  fonts/                Font resolution and loading
    font-manager.ts     Three-layer resolver
    font-metrics.ts     Ascent/descent/lineHeight extraction
    normalize.ts        Family-name normalization

  __snapshots__/        Locked SVG outputs for snapshot tests

fonts/                  Bundled test fixtures (Inter Regular/Bold under OFL)
scripts/
  tag-release.js        Tag-and-push for release:github
```

For deeper detail on the search algorithm, see [architecture.md](./architecture.md). For how fonts are resolved and loaded, see [fonts.md](./fonts.md).

## Contributing

Issues and pull requests welcome at <https://github.com/mdubb86/fitfull>. A few notes to make review easier:

- Match the existing TypeScript style — strict typing, no `any` unless unavoidable.
- Keep PRs focused. If a change touches both the fitter and rendering, splitting them up tends to be easier to review.
- Run `pnpm test` before pushing. If your change updates rendering, include the regenerated snapshot files.
- New behavior should come with a test; bug fixes should come with a regression test.
