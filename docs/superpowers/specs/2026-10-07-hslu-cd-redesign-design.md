# HSLU Corporate Design Redesign — Design Spec

Date: 2026-10-07
Status: approved in conversation, pending written-spec review

## Goal

Restyle the IRC al-folio site so it follows the HSLU corporate design (CD) while the
Immersive Realities Center stays the visible identity ("HSLU-aligned, IRC-led").

Authority: HSLU Frontify brand portal, _Grundelemente_, local copy at
`~/agent_references/hslu_frontify/HSLU-Brand-Reference/` (captured 2026-10-07).
Where the capture has gaps (type sizes, grid), the live hslu.ch implementation is the reference.

## Decisions (from the user)

| Topic         | Decision                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Brand depth   | HSLU-aligned, IRC-led                                                                                     |
| Dark mode     | Removed (light only)                                                                                      |
| Scope         | Header/nav, footer, home page, project cards, publications                                                |
| Typeface      | Verdana now; stack prepared for FS Albert Web if M&K approves hosting                                     |
| Logo addition | Two levels: **Computer Science and Information Technology** (Bold) / Immersive Realities Center (Regular) |
| Approach      | Token remap + two small override partials + targeted template edits (keep al-folio upstream-mergeable)    |

## CD rules that apply

- Logo: official file only, black on white, top-left, min 160 px wide, protection zone 1 H
  (≈ 11.8 % of EN logo width). English site → `HSLU_Logo_EN_Schwarz_rgb.svg`. Never on photos.
- Additions sit right of the logo, bottom-aligned, ≥ 1 H away, never below the logo.
- "FH Zentralschweiz" (Bold) is mandatory on websites.
- Text is always `#000`. No coloured text, no white text on colour, no text on `dunkel-1/2`.
- Accents (Blau `#77c5d8`, Grün, Magenta, Gelb) used sparingly; white space dominates.
- Only Regular (400) and Bold (700). Headlines Regular, sublines Bold.

## Design

### 1. Colour tokens (`_sass/_variables.scss`, `_sass/_themes.scss`)

- Add HSLU palette variables (neutrals, four accents, blue gradations used below).
- `--global-text-color`, `--global-text-color-light`, `--global-theme-color`,
  `--global-hover-color`: `#000`.
- New `--global-accent-color: #77c5d8` (Blau) for fills; text on it stays black.
- `--global-link-underline-color: #449dc2` (Blau Dunkel 1, used only as a line, never behind text).
- `--global-focus-color: #206a8a` (Blau Dunkel 2, 6.3:1 on white).
- Panels/hover surfaces: Grau `#f0f0f0`, Blau Hell 1 `#daeef3`, Blau Hell 2 `#bae0ea`.
- Footer: Blau Hell 1 background, black text, black links.
- Delete the `html[data-theme="dark"]` block; set `enable_darkmode: false`.

### 2. Overrides (`_sass/_hslu.scss` + `_sass/_hslu-layout.scss`, imported last in `assets/css/main.scss`)

Covers every place al-folio uses `--global-theme-color` as a **fill** (with white text) and
the component restyling:

- Links: black, underline `--global-link-underline-color`, offset 4px; hover underline black
  and thicker; `:focus-visible` outline in `--global-focus-color`.
- Publication `.abbr` badges, CV badges, progress bar, tags: Blau fill, black text, square.
- Publication `.links a.btn`: square black outline, hover Blau Hell 2 fill, black text.
- Project cards: `border-radius: 0`, no shadow, white, Bold black title, hover Grau.
- Buttons/inputs (bib search): square corners.
- Typography: font stack `"FS Albert Web", "FS Albert", Verdana, sans-serif` for body and
  headings (overrides MDB's Roboto); weights 400/700 only; h1 Regular 2.25rem (1.625rem
  < 768px); h2–h3 Bold; body 1rem / 1.5; `font-variant-ligatures: common-ligatures`.

Target: each partial < 300 lines (header/footer/cover styles live in `_hslu-layout.scss`).

### 3. Header (`_includes/header.liquid`)

- Row 1: logo (`assets/img/hslu/HSLU_Logo_EN_Schwarz_rgb.svg`, 180px wide, alt
  "Lucerne University of Applied Sciences and Arts – Immersive Realities Center home")
  links to `/`; padding ≥ 1 H (21px) around it. Addition block to the right, ≥ 1 H gap,
  bottom-aligned with the logo baseline: line 1 Bold, line 2 Regular, ~0.8125rem.
- Row 2: nav items aligned to the logo's left edge; active/hover = Blau Hell 2 background,
  black text; search trigger kept.
- Below `sm` (576px): addition hidden; logo stays 160px; hamburger right.
- Header is static (not fixed): `navbar_fixed: false` plus template change so it does not stick.
- Dark-mode toggle removed (via `enable_darkmode: false`).

### 4. Footer (`_includes/footer.liquid`, `_config.yml`)

- `footer_fixed: false`; normal flow, 2px black top rule, Blau Hell 1 background.
- Left: **FH Zentralschweiz** (Bold), then IRC address from new `_config.yml` keys
  (`footer_address`, prefilled "Immersive Realities Center, Campus Zug-Rotkreuz,
  Suurstoffi 12, 6343 Rotkreuz" — **user to confirm**), email, LinkedIn.
- Right: Impressum, link to https://sites.hslu.ch/immersive-realities/en/, "© {year}
  Immersive Realities Center, HSLU". Fix the current duplicated year in `footer_text`.

### 5. Home page (`_layouts/about.liquid`, `_pages/about.md`)

- Cover pattern: large Regular headline "Immersive Realities Center", Bold subline from
  `page.subtitle` (e.g. "Research at HSLU Computer Science and Information Technology").
- Teaser image as square-cornered block below; one round Blau "Störer" badge
  (black text "More at sites.hslu.ch/immersive-realities", links there) overlapping the
  image's top-right edge; hidden < 576px if it would cover content.
- Intro text below; social icons black.

### 6. Other

- Remove Google Fonts link in `_includes/head.liquid` (Roboto, Roboto Slab, Material Icons unused).
- Remove unused venue colours in `_data/venues.yml` (no bib entry matches them).
- README: short "Design" section pointing to this spec and the CD rules.

## Out of scope / flagged

- `assets/img/icon.png` (red "HSLU" on photo) violates logo rules; not used. Favicon stays 🥽.
- CD prescribes American English for CS&IT; existing texts use British spelling. No content edits.
- Syntax-highlighted code keeps its colours.
- FS Albert Web files: only after written approval from M&K (grafik@hslu.ch).

## Verification

1. `bundle exec jekyll build` succeeds.
2. Playwright script (scratchpad, not committed) on the built site, 1280px and 375px:
   - every visible text element outside `pre/code` computes `color: rgb(0, 0, 0)`;
   - logo rendered width ≥ 160px;
   - no element uses `font-weight` other than 400/700.
3. Screenshots (home, projects, one project page, publications × 2 widths) handed to the user
   with a CD checklist for visual review.
4. Code review pass before commit.
