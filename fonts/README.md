# Test Fonts

These fonts are bundled as test fixtures so tests run without system fonts.

- **Inter Regular / Bold** — https://github.com/rsms/inter — SIL OFL 1.1
- **Playfair Display Italic** — https://github.com/clauseggers/Playfair — SIL OFL 1.1
  Italic outlines exercise the off-curve bbox path in `measureLine`; needed by
  the width-overflow regression in `fitfull.test.ts`.
