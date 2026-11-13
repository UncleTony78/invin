# InVin logo kit · v1.0 (Slot)

**Positioning:** For freelancers, creators and small businesses, InVin is the invoicing app that makes getting paid feel calm, quick and a little bit delightful.

**Idea:** A tile with a coin slot. Every invoice is a slot money drops into. The slot is cut at exactly the wordmark's stroke weight (26 units in the symbol = 22 in the word at lockup scale), so symbol and word read as one family.

## Files

| File | Use |
|---|---|
| `lockup-horizontal-primary.svg` | **Default.** Tangerine symbol + ink word, on paper or white |
| `lockup-horizontal-reversed.svg` | On ink / dark surfaces |
| `lockup-horizontal-ink.svg` | All ink, on tangerine fields and one-colour print |
| `lockup-horizontal-white.svg` | All white, on photos or dark colour |
| `lockup-stacked-*.svg` | Square-ish spaces (splash, merch, avatars with room) |
| `symbol.svg` / `symbol-ink.svg` | Symbol alone, ≥ 48 px |
| `symbol-small.svg` | Small-size cut (bigger slot) for 32 px and below |
| `wordmark.svg` / `wordmark-white.svg` | Word alone, where the symbol already appears nearby |
| `icons/` | `favicon.ico`, `favicon.svg`, PNG favicons, apple-touch, 192/512, maskable, `site.webmanifest`, `head-snippet.html` |
| `exports/` | 1200 px PNGs of the horizontal lockup (black, white, tangerine) |
| `board.html` / `board.png` | Brand board |
| `build.py`, `board.py` | Source: all geometry is generated, edit here, not in the SVGs |

## Colour

| Name | HEX | RGB | Job | Contrast |
|---|---|---|---|---|
| Tangerine | `#FF5A1F` | 255 90 31 | Brand, symbol, primary buttons (always with an ink label) | ink on it 5.9:1 · white on it 3.1:1 (large only) |
| Ink | `#16130F` | 22 19 15 | Wordmark, text, dark surfaces | on paper 16.4:1 |
| Paper | `#F4F1EA` | 244 241 234 | App canvas, brand backgrounds | — |
| Stone | `#6B665E` | 107 102 94 | Secondary text, labels | on paper 5.1:1 |
| Paid green | `#127A43` | 18 122 67 | Status only: paid, success | on white 5.4:1 · on paper 4.8:1 |

Tangerine is never used for text. Print values (CMYK / Pantone) must be matched by a printer from a proof; nearest starting point Pantone 1655 C (not verified).

## Type

Updated 2026-11-13 to match the app reference the team chose.

- **IBM Plex Sans** (SIL Open Font License): UI, headings and invoices. 400/500/600. Headings −2% tracking. Product scale ×1.2: 12 · 13 · 14 · 15 · 18 · 22 · 28 · 34.
- **IBM Plex Mono** (SIL Open Font License): invoice numbers, series IDs and other codes.
- The wordmark is **custom-drawn** and is not a font. Never retype "invin" in any typeface.
- The brand board (`board.png`) still shows the earlier Inter + Geist Mono pairing; regenerate it before sharing.

## Rules

- **Clear space:** one slot height (the height of the slot in the symbol) on every side.
- **Minimum size:** lockup 72 px wide on screen / 18 mm in print; symbol 16 px (use the small cut ≤ 32 px).
- **Lowercase** in the logo; in sentences write **InVin**.

## Don'ts

1. Don't stretch, squash, rotate or re-space the logo.
2. Don't place it on clashing colours or busy photos without the white version.
3. Don't recolour outside the palette.
4. No shadows, glows, outlines or gradients.
5. Don't retype the wordmark in a font.

## Open items

- **Trademark:** no clearance search has been done. Run one (USPTO / EUIPO / WIPO Global Brand Database, plus a reverse image search on the symbol) before launch.
- Pantone/CMYK values need a print proof.
- Inter and Geist Mono are loaded from Google Fonts on the board; self-host them in the app.
