# HSLU CD Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the IRC al-folio Jekyll site to the HSLU corporate design, light-only, IRC-led.

**Architecture:** Re-point al-folio's CSS custom properties to HSLU values, add two override partials imported last (`_sass/_hslu.scss` for typography/components, `_sass/_hslu-layout.scss` for header/footer/cover), and edit four templates (head, header, footer, about). No changes to `_sass/_base.scss` so upstream al-folio stays mergeable.

**Tech Stack:** Jekyll 4 (al-folio), Bootstrap 4 + MDB, SCSS, Liquid. Verification via the Playwright MCP tool (`browser_run_code_unsafe`) against a locally served build.

**Spec:** `docs/superpowers/specs/2026-10-07-hslu-cd-redesign-design.md`
**Brand reference:** `~/agent_references/hslu_frontify/HSLU-Brand-Reference/AGENTS.md` (read it first)

## Global Constraints

- Text colour is always `#000`, except syntax-highlighted code. No white text on colour, no text on `#449dc2`/`#206a8a`.
- Only font weights 400 and 700. Headlines (h1) 400, sublines (h2–h6, card titles) 700.
- Font stack: `"FS Albert Web", "FS Albert", Verdana, sans-serif`. No Google Fonts.
- Logo: `HSLU_Logo_EN_Schwarz_rgb.svg`, unmodified, top-left, rendered width ≥ 160px at every viewport, clear space ≥ 22px (1 H at 180px ≈ 21.3px).
- Addition text never below the logo; hidden below 576px.
- "FH Zentralschweiz" in Bold on every page (footer).
- Dark mode off; `determineComputedTheme()` must return `"light"` even on a dark-OS browser.
- Do not touch `_sass/_base.scss`. Do not stage `Gemfile.lock`, `package.json`, `package-lock.json`, `assets/img/icon.png` (pre-existing unrelated changes).
- Each new SCSS partial stays under 300 lines: `_sass/_hslu.scss` (tokens use, typography, components) and `_sass/_hslu-layout.scss` (header, footer, home cover).

## Review Focus

1. **Dark-OS visitors** — expect search modal/mermaid in light theme. Test: Task 1 emulates `prefers-color-scheme: dark` and asserts `computedTheme === "light"`.
2. **320px phones** — expect no horizontal scroll, logo still ≥160px. Test: every check runs at 320px and asserts `horizontalOverflow === false`.
3. **Keyboard users** — expect a visible focus ring on links/buttons now that link colour no longer signals focus. Test: Task 2 tabs to the first link and asserts a non-`none` outline.
4. **Scroll progress bar** — it was pinned at `top: 56px` for the fixed navbar; with a static header it would float mid-header. Test: Task 3 asserts `progressTop === "0px"`.
5. **Publication year headings and venue badges** — al-folio paints them light-grey / white-on-colour. Test: the colour check covers `/publications/` at all widths.

---

## Shared verification harness (used by every task)

Paths: `S=/private/tmp/claude-501/-Users-philipp-projects-irc-hslu-github-io/3abf89dc-f837-40c8-a7d4-cc2a3a13f1aa/scratchpad`

**Build** (≈20 s): `bundle exec jekyll build -d $S/site`
**Serve** (once, background): `python3 -m http.server 4100 --directory $S/site`

**Check** — call the Playwright MCP tool `browser_run_code_unsafe` with this code (saved verbatim to `$S/cd-check.js` in Task 0 for reuse):

```js
async (page) => {
  const check = () => {
    const SKIP = 'pre, code, .highlight, svg, mjx-container, ninja-keys, script, style, noscript';
    const WEIGHTS = new Set(['400', '700']);
    const colour = [], weight = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest(SKIP)) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (!el.getClientRects().length || cs.visibility === 'hidden') continue;
      const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      const label = `${el.tagName.toLowerCase()}${cls} "${el.textContent.trim().slice(0, 30)}"`;
      if (cs.color !== 'rgb(0, 0, 0)') colour.push(`${label} -> ${cs.color}`);
      if (!WEIGHTS.has(cs.fontWeight)) weight.push(`${label} -> ${cs.fontWeight}`);
    }
    const logo = document.querySelector('.hslu-logo img');
    const progress = document.querySelector('progress');
    const footer = document.querySelector('footer');
    return {
      url: location.pathname, width: innerWidth,
      colourCount: colour.length, colour: colour.slice(0, 15),
      weightCount: weight.length, weight: weight.slice(0, 15),
      bodyFont: getComputedStyle(document.body).fontFamily,
      logoWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
      additionVisible: !!document.querySelector('.hslu-addition')?.getClientRects().length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      computedTheme: typeof determineComputedTheme === 'function' ? determineComputedTheme() : null,
      fhZentralschweiz: document.body.innerText.includes('FH Zentralschweiz'),
      footerPosition: footer ? getComputedStyle(footer).position : null,
      progressTop: progress ? getComputedStyle(progress).top : null,
    };
  };
  const urls = ['/', '/projects/', '/publications/', '/impressum/', '/RedirectedWalking/',
    '/RedirectedWalkingAuditory/', '/SubjectiveQualityAssessment/', '/VVCaptureAndReconstruction/',
    '/GSvsPhotogrammetry/', '/UXGuidelines/'];
  const results = [];
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const u of urls) {
      await page.goto('http://localhost:4100' + u);
      results.push(await page.evaluate(check));
    }
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://localhost:4100/');
  const darkOs = await page.evaluate(() => determineComputedTheme());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:4100/');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { tag: document.activeElement.tagName, outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor };
  });
  return { darkOs, focus, results };
}
```

"Run check" in a task means: build, then run the harness, then compare the fields named in that task's **Expected**.

---

### Task 0: Branch, exclude docs, harness, baseline

**Files:**
- Modify: `_config.yml:125-144` (exclude list)
- Create (scratchpad, not committed): `$S/cd-check.js`

- [ ] **Step 1: Create branch**

```bash
git switch -c hslu-cd-redesign
```

- [ ] **Step 2: Stop publishing the spec/plan** — add to `exclude:` in `_config.yml`, after `- vendor`:

```yaml
  - docs/superpowers/
```

- [ ] **Step 3: Save harness** — write the harness code above to `$S/cd-check.js`.

- [ ] **Step 4: Build, serve, run check (baseline = red)**

Expected: `colourCount > 0` on most pages (purple links), `logoWidth: null`, `fhZentralschweiz: false`, `darkOs: "dark"`, `bodyFont` contains `Roboto`. Also confirm `$S/site/docs/superpowers` does **not** exist.

- [ ] **Step 5: Commit**

```bash
git add _config.yml docs/superpowers/
git commit -m "Add HSLU CD redesign spec and plan; exclude them from the site build"
```

---

### Task 1: Tokens, typography, light-only

**Files:**
- Modify: `_sass/_variables.scss` (append palette)
- Modify: `_sass/_themes.scss` (replace whole file)
- Create: `_sass/_hslu.scss`
- Modify: `assets/css/main.scss` (import `hslu` after `typograms`)
- Modify: `_includes/head.liquid` (remove Google Fonts link; pin light theme)
- Modify: `_config.yml` (`enable_darkmode: false`)

**Interfaces:**
- Produces SCSS variables: `$hslu-black, $hslu-white, $hslu-grey, $hslu-blau, $hslu-blau-hell-1, $hslu-blau-hell-2, $hslu-blau-dunkel-1, $hslu-blau-dunkel-2, $hslu-gruen, $hslu-gruen-hell-1, $hslu-magenta, $hslu-magenta-hell-1, $hslu-gelb, $hslu-gelb-hell-1, $hslu-font-family, $hslu-logo-width, $hslu-logo-width-min, $hslu-clearspace`.
- Produces CSS custom properties: `--global-accent-color`, `--global-accent-light-color`, `--global-link-underline-color`, `--global-focus-color` (plus all existing `--global-*`).

- [ ] **Step 1: Run check — confirm red for this task's fields**

Expected now: `darkOs: "dark"`, `bodyFont` contains `Roboto`, `weightCount > 0` somewhere.

- [ ] **Step 2: Append to `_sass/_variables.scss`**

```scss
// HSLU corporate design (Frontify › Grundelemente). Dunkel tones are for lines only, never behind text.
$hslu-black: #000000;
$hslu-white: #ffffff;
$hslu-grey: #f0f0f0;
$hslu-blau: #77c5d8;
$hslu-blau-hell-1: #daeef3;
$hslu-blau-hell-2: #bae0ea;
$hslu-blau-dunkel-1: #449dc2;
$hslu-blau-dunkel-2: #206a8a;
$hslu-gruen: #adca2a;
$hslu-gruen-hell-1: #e9f0c1;
$hslu-magenta: #ee6a87;
$hslu-magenta-hell-1: #fbd0d3;
$hslu-gelb: #fcc300;
$hslu-gelb-hell-1: #fff0be;

$hslu-font-family: "FS Albert Web", "FS Albert", Verdana, sans-serif;

// Logo protection zone is 1 × the "H" width (26/220 of the EN logo width).
$hslu-logo-width: 180px;
$hslu-logo-width-min: 160px;
$hslu-clearspace: 22px;
```

- [ ] **Step 3: Replace `_sass/_themes.scss`**

```scss
/*******************************************************************************
 * Theme (light only, HSLU corporate design)
 ******************************************************************************/

:root {
  color-scheme: light;
  --global-bg-color: #{$hslu-white};
  --global-code-bg-color: #{$hslu-grey};
  --global-text-color: #{$hslu-black};
  --global-text-color-light: #{$hslu-black};
  --global-theme-color: #{$hslu-black};
  --global-hover-color: #{$hslu-black};
  --global-hover-text-color: #{$hslu-black};
  --global-accent-color: #{$hslu-blau};
  --global-accent-light-color: #{$hslu-blau-hell-2};
  --global-link-underline-color: #{$hslu-blau-dunkel-1};
  --global-focus-color: #{$hslu-blau-dunkel-2};
  --global-footer-bg-color: #{$hslu-blau-hell-1};
  --global-footer-text-color: #{$hslu-black};
  --global-footer-link-color: #{$hslu-black};
  --global-distill-app-color: #{$hslu-black};
  --global-divider-color: rgba(0, 0, 0, 0.15);
  --global-card-bg-color: #{$hslu-white};
  --global-highlight-color: #{$hslu-black};
  --global-back-to-top-bg-color: #{$hslu-grey};
  --global-back-to-top-text-color: #{$hslu-black};
  --global-newsletter-bg-color: #{$hslu-white};
  --global-newsletter-text-color: #{$hslu-black};

  --global-tip-block: #{$hslu-gruen};
  --global-tip-block-bg: #{$hslu-gruen-hell-1};
  --global-tip-block-text: #{$hslu-black};
  --global-tip-block-title: #{$hslu-black};
  --global-warning-block: #{$hslu-gelb};
  --global-warning-block-bg: #{$hslu-gelb-hell-1};
  --global-warning-block-text: #{$hslu-black};
  --global-warning-block-title: #{$hslu-black};
  --global-danger-block: #{$hslu-magenta};
  --global-danger-block-bg: #{$hslu-magenta-hell-1};
  --global-danger-block-text: #{$hslu-black};
  --global-danger-block-title: #{$hslu-black};

  .only-light {
    display: block;
  }

  .only-dark {
    display: none;
  }

  #back-to-top {
    color: var(--global-back-to-top-text-color);
    background: var(--global-back-to-top-bg-color);
    bottom: $back-to-top-bottom;
    right: $back-to-top-right;
    height: $back-to-top-height;
    width: $back-to-top-width;
    z-index: $back-to-top-z-index;
  }
}
```

- [ ] **Step 4: Create `_sass/_hslu.scss` (typography section; later tasks append)**

```scss
/*******************************************************************************
 * HSLU corporate design overrides
 * Spec: docs/superpowers/specs/2026-10-07-hslu-cd-redesign-design.md
 ******************************************************************************/

// Typography: Regular and Bold only; hierarchy through size.

body,
button,
input,
.btn,
.navbar {
  font-family: $hslu-font-family;
}

body {
  font-size: 1rem;
  line-height: 1.5;
  font-variant-ligatures: common-ligatures;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    scroll-margin-top: 1rem;
  }
}

h1,
.h1,
.display-1,
.display-2,
.display-3,
.display-4,
.lead,
.font-weight-light,
.font-weight-lighter {
  font-weight: 400;
}

h2,
h3,
h4,
h5,
h6,
b,
strong,
.font-weight-bold,
.font-weight-bolder {
  font-weight: 700;
}

h1,
.h1 {
  font-size: 1.625rem;
  line-height: 1.25;

  @media (min-width: 768px) {
    font-size: 2.25rem;
  }
}
```

- [ ] **Step 5: Import it last in `assets/css/main.scss`** — change `"typograms",` to:

```scss
  "typograms",
  "hslu",
```

- [ ] **Step 6: `_includes/head.liquid`** — delete the Google Fonts `<link … google_fonts.url.fonts …>` block (lines 27–32). After `<script src="{{ '/assets/js/theme.js' … }}"></script>` add:

```liquid
{% unless site.enable_darkmode %}
  <script>
    determineComputedTheme = () => 'light';
  </script>
{% endunless %}
```

- [ ] **Step 7: `_config.yml`** — set `enable_darkmode: false`.

- [ ] **Step 8: Run check**

Expected: `darkOs: "light"`, `bodyFont` starts with `"FS Albert Web", "FS Albert", Verdana`, `weightCount: 0` on all pages (if not, the listed selectors go into the h1/h2 blocks in Step 4). `colourCount` may still be > 0 (fixed in Task 2).

- [ ] **Step 9: Commit**

```bash
git add _sass/_variables.scss _sass/_themes.scss _sass/_hslu.scss assets/css/main.scss _includes/head.liquid _config.yml
git commit -m "Apply HSLU colour tokens and typography; make the site light-only"
```

---

### Task 2: Component overrides (links, fills, cards, publications)

**Files:**
- Modify: `_sass/_hslu.scss` (append)
- Modify: `_data/venues.yml` (remove `color:` keys)

**Interfaces:** consumes the custom properties from Task 1.

- [ ] **Step 1: Run check — note red items**

Expected: `colourCount > 0` on `/publications/` (`h2.bibliography` grey, `abbr` white) and wherever `.author-info a` (#1a73e8) appears; `focus.outlineStyle` likely `none`.

- [ ] **Step 2: Append to `_sass/_hslu.scss`**

```scss
// Links: black text, blue underline (hslu.ch pattern), visible keyboard focus.

a,
table.table a {
  color: var(--global-text-color);
  text-decoration: underline;
  text-decoration-color: var(--global-link-underline-color);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;

  &:hover {
    color: var(--global-text-color);
    text-decoration-color: var(--global-text-color);
    text-decoration-thickness: 2px;
  }
}

.navbar a,
.projects a,
.social a,
.btn,
.abbr a,
.hslu-stoerer {
  text-decoration: none;
}

a:focus-visible,
button:focus-visible,
.btn:focus-visible,
input:focus-visible {
  outline: 2px solid var(--global-focus-color);
  outline-offset: 2px;
}

.author-info a {
  color: var(--global-text-color);
}

// Accent fills always carry black text.

.publications ol.bibliography li .abbr abbr,
.cv .card .list-group-item .badge,
.pagination .page-item.active .page-link {
  background-color: var(--global-accent-color) !important;
  color: var(--global-text-color) !important;
  border-radius: 0;

  a {
    color: var(--global-text-color);
  }
}

::highlight(search) {
  background-color: var(--global-accent-color);
}

blockquote {
  border-left-color: var(--global-accent-color);
}

pre,
code {
  color: var(--global-text-color);
  border-radius: 0;
}

progress {
  color: var(--global-accent-color);
}

progress::-webkit-progress-value,
.progress-bar {
  background-color: var(--global-accent-color);
}

progress::-moz-progress-bar {
  background-color: var(--global-accent-color);
}

// Publications

.publications h2.bibliography,
.projects h2.category {
  color: var(--global-text-color);
  border-color: var(--global-text-color);
}

.publications ol.bibliography li .author a {
  border-bottom: 0;
}

.publications ol.bibliography li .links a.btn,
.custom-single .links a.btn {
  border-radius: 0;
  box-shadow: none;

  &:hover {
    color: var(--global-text-color);
    border-color: var(--global-text-color);
    background-color: var(--global-accent-light-color);
  }
}

.bibsearch-form-input {
  border-radius: 0;
  box-shadow: none;
}

// Cards: square, flat, grey on hover.

.card,
.card img,
.card-img-top {
  border-radius: 0;
}

.card,
.hoverable,
.hoverable:hover {
  box-shadow: none;
}

.projects a:hover {
  .card {
    background-color: $hslu-grey;
  }

  .card-title {
    color: var(--global-text-color);
  }
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
}
```

- [ ] **Step 3: `_data/venues.yml`** — delete the two `color:` lines (`"#00369f"`, `"#009f36"`). No bib entry uses these venues; this prevents future white-on-colour badges.

- [ ] **Step 4: Run check**

Expected: `colourCount: 0` and `weightCount: 0` on every URL at every width; `focus.outlineStyle: "solid"`, `focus.outlineColor: "rgb(32, 106, 138)"`. For any remaining colour item, add the narrowest selector from the label to the matching block above and re-run.

- [ ] **Step 5: Commit**

```bash
git add _sass/_hslu.scss _data/venues.yml
git commit -m "Restyle links, badges, buttons and cards to HSLU black-on-accent rules"
```

---

### Task 3: Header with HSLU logo and addition

**Files:**
- Create: `assets/img/hslu/HSLU_Logo_EN_Schwarz_rgb.svg` (copy, unmodified)
- Modify: `_includes/header.liquid` (brand row + nav row)
- Create: `_sass/_hslu-layout.scss`
- Modify: `assets/css/main.scss` (import `hslu-layout` after `hslu`)
- Modify: `_config.yml` (`navbar_fixed: false`, new `hslu_addition`)

**Interfaces:**
- Produces config keys `site.hslu_addition.department`, `site.hslu_addition.unit`.
- Produces classes `.hslu-header`, `.hslu-brand`, `.hslu-logo`, `.hslu-addition`, used by the harness.

- [ ] **Step 1: Run check** — expected red: `logoWidth: null`, `progressTop: "56px"`.

- [ ] **Step 2: Copy logo**

```bash
mkdir -p assets/img/hslu
cp ~/agent_references/hslu_frontify/HSLU-Brand-Reference/assets/logos/svg/HSLU_Logo_EN_Schwarz_rgb.svg assets/img/hslu/
```

- [ ] **Step 3: `_config.yml`** — set `navbar_fixed: false`; add under the `footer_text` block:

```yaml
hslu_addition: # shown right of the HSLU logo (CD "Zusatz"): level 1 bold, level 2 regular
  department: Computer Science and Information Technology
  unit: Immersive Realities Center
```

- [ ] **Step 4: `_includes/header.liquid`** — replace from `<header>` through the line `<div class="collapse navbar-collapse text-right" id="navbarNav">` and the following `<ul class="navbar-nav ml-auto flex-nowrap">` with:

```liquid
<header class="hslu-header">
  <div class="container hslu-brand">
    <a class="hslu-logo" href="{{ '/' | relative_url }}">
      <img
        src="{{ '/assets/img/hslu/HSLU_Logo_EN_Schwarz_rgb.svg' | relative_url }}"
        width="180"
        height="29"
        alt="Lucerne University of Applied Sciences and Arts – {{ site.title }} home"
      >
    </a>
    {% if site.hslu_addition %}
      <p class="hslu-addition">
        <strong>{{ site.hslu_addition.department }}</strong><br>
        {{ site.hslu_addition.unit }}
      </p>
    {% endif %}
    <button
      class="navbar-toggler collapsed d-sm-none"
      type="button"
      data-toggle="collapse"
      data-target="#navbarNav"
      aria-controls="navbarNav"
      aria-expanded="false"
      aria-label="Toggle navigation"
    >
      <span class="sr-only">Toggle navigation</span>
      <span class="icon-bar top-bar"></span>
      <span class="icon-bar middle-bar"></span>
      <span class="icon-bar bottom-bar"></span>
    </button>
  </div>
  <!-- Nav Bar -->
  <nav id="navbar" class="navbar navbar-light navbar-expand-sm" role="navigation">
    <div class="container">
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav mr-auto flex-nowrap">
```

Everything after (nav items, search, darkmode toggle, closing tags, progress bar) stays unchanged.

- [ ] **Step 5: Create `_sass/_hslu-layout.scss` and import it** — in `assets/css/main.scss` change `"hslu",` to `"hslu",
  "hslu-layout",`. File content:

```scss
/*******************************************************************************
 * HSLU corporate design: header, footer, home cover
 ******************************************************************************/

// Header: logo top-left with 1 H clear space, addition right of it, bottom-aligned.

.container {
  padding-left: $hslu-clearspace;
  padding-right: $hslu-clearspace;
}

.hslu-brand {
  display: flex;
  align-items: flex-end;
  padding-top: $hslu-clearspace;
  padding-bottom: $hslu-clearspace;

  .hslu-logo {
    flex: 0 0 auto;
    margin-right: $hslu-clearspace;

    img {
      display: block;
      width: $hslu-logo-width;
      min-width: $hslu-logo-width-min;
      height: auto;
    }
  }

  .navbar-toggler {
    margin-left: auto;
    align-self: center;
    padding: 0.5rem 0;
    border: 0;
  }
}

.hslu-addition {
  display: none;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.3;

  @media (min-width: 576px) {
    display: block;
    margin-left: auto;
  }

  @media (min-width: 768px) {
    margin-left: 0;
    padding-left: calc(50% - #{$hslu-logo-width} - #{$hslu-clearspace});
  }
}

.hslu-header .navbar {
  padding: 0;
  opacity: 1;
  border-bottom: 1px solid var(--global-text-color);

  .navbar-nav {
    margin-left: -0.75rem;
  }

  .navbar-nav .nav-item .nav-link {
    padding: 0.5rem 0.75rem;
  }

  .navbar-nav .nav-item.active > .nav-link,
  .navbar-nav .nav-item .nav-link:hover {
    font-weight: 400;
    background-color: var(--global-accent-light-color);
  }
}

progress,
.progress-container {
  top: 0;
}
```

- [ ] **Step 6: Run check**

Expected at all URLs: `logoWidth ≥ 160` (180 at 1280/375; ≥160 at 320), `additionVisible: true` at 1280 and `false` at 375/320, `horizontalOverflow: false` everywhere, `progressTop: "0px"`, `colourCount: 0`, `weightCount: 0`. Also click the hamburger at 375 via Playwright and confirm nav links become visible (`#navbarNav` has class `show`).

- [ ] **Step 7: Commit**

```bash
git add assets/img/hslu/HSLU_Logo_EN_Schwarz_rgb.svg _includes/header.liquid _sass/_hslu-layout.scss assets/css/main.scss _config.yml
git commit -m "Add HSLU logo header with department and IRC addition"
```

---

### Task 4: Footer with FH Zentralschweiz

**Files:**
- Modify: `_includes/footer.liquid` (replace whole file)
- Modify: `_sass/_hslu-layout.scss` (append)
- Modify: `_config.yml` (`footer_fixed: false`, `footer_text`, new `footer_address`)

- [ ] **Step 1: Run check** — expected red: `fhZentralschweiz: false`, `footerPosition: "fixed"`.

- [ ] **Step 2: `_config.yml`** — set `footer_fixed: false`; replace `footer_text` value with `Immersive Realities Center, HSLU.`; add:

```yaml
footer_address: # IRC postal address, one line per entry (matches the Impressum)
  - Immersive Realities Center IRC
  - HSLU Campus Zug-Rotkreuz
  - Suurstoffi 12
  - 6343 Rotkreuz
```

- [ ] **Step 3: Replace `_includes/footer.liquid`**

```liquid
<footer class="hslu-footer" role="contentinfo">
  <div class="container">
    <div class="row">
      <div class="col-sm-6">
        <p><strong>FH Zentralschweiz</strong></p>
        <address>{{ site.footer_address | join: '<br>' }}</address>
      </div>
      <div class="col-sm-6">
        <ul class="hslu-footer-links">
          {% if site.data.socials.email %}
            <li><a href="mailto:{{ site.data.socials.email }}">{{ site.data.socials.email }}</a></li>
          {% endif %}
          {% if site.data.socials.linkedin_company %}
            <li><a href="https://www.linkedin.com/company/{{ site.data.socials.linkedin_company }}">LinkedIn</a></li>
          {% endif %}
          <li><a href="https://sites.hslu.ch/immersive-realities/en/">IRC on hslu.ch</a></li>
          {% if site.impressum_path %}
            <li><a href="{{ site.impressum_path | relative_url }}">Impressum</a></li>
          {% endif %}
        </ul>
      </div>
    </div>
    <p class="hslu-footer-copyright">
      &copy; {{ site.time | date: '%Y' }}
      {{ site.footer_text }}
      {% if site.last_updated %}
        Last updated: {{ 'now' | date: '%B %d, %Y' }}.
      {% endif %}
    </p>
  </div>
</footer>
```

- [ ] **Step 4: Append to `_sass/_hslu-layout.scss`**

```scss
// Footer

.hslu-footer {
  margin-top: 4rem;
  padding: 2rem 0;
  border-top: 2px solid var(--global-text-color);
  background-color: var(--global-footer-bg-color);
  font-size: 0.875rem;

  p,
  address,
  .hslu-footer-links {
    margin-bottom: 1rem;
  }

  address {
    font-style: normal;
  }

  .hslu-footer-links {
    list-style: none;
    padding: 0;
  }

  .hslu-footer-copyright {
    margin-bottom: 0;
  }
}
```

- [ ] **Step 5: Run check**

Expected everywhere: `fhZentralschweiz: true`, `footerPosition: "static"`, `colourCount: 0`, `horizontalOverflow: false`. Also the footer copyright line in `$S/site/index.html` reads `© 2026 Immersive Realities Center, HSLU.` with no second year.

- [ ] **Step 6: Commit**

```bash
git add _includes/footer.liquid _sass/_hslu-layout.scss _config.yml
git commit -m "Replace fixed footer with HSLU footer including FH Zentralschweiz"
```

---

### Task 5: Home page cover with Störer

**Files:**
- Modify: `_layouts/about.liquid:4-17` (post-header)
- Modify: `_pages/about.md` (front matter: `subtitle`, `cover_badge`)
- Modify: `_sass/_hslu-layout.scss` (append)

**Interfaces:** consumes `page.subtitle`, `page.teaser_image`, new `page.cover_badge.{lead,link_text,url}`.

- [ ] **Step 1: Run check on `/`** — note there is no `.hslu-cover`/`.hslu-stoerer` yet (red).

- [ ] **Step 2: `_pages/about.md` front matter** — set `subtitle:` and add `cover_badge:`

```yaml
subtitle: Research in virtual, augmented and mixed reality
cover_badge:
  lead: More at
  link_text: sites.hslu.ch/<wbr>immersive-realities
  url: https://sites.hslu.ch/immersive-realities/en/
```

- [ ] **Step 3: `_layouts/about.liquid`** — replace the `<header class="post-header"> … </header>` block with:

```liquid
<header class="post-header hslu-cover">
  <h1 class="post-title">{{ site.title }}</h1>
  {% if page.subtitle %}
    <p class="hslu-cover-subline">{{ page.subtitle }}</p>
  {% endif %}
  {% if page.teaser_image %}
    <div class="hslu-cover-media">
      <img class="teaser-image" src="{{ page.teaser_image | relative_url }}" alt="Teaser image for {{ page.title }}">
      {% if page.cover_badge %}
        <a class="hslu-stoerer" href="{{ page.cover_badge.url }}">
          <span>{{ page.cover_badge.lead }}</span>
          <strong>{{ page.cover_badge.link_text }}</strong>
        </a>
      {% endif %}
    </div>
  {% endif %}
</header>
```

- [ ] **Step 4: Append to `_sass/_hslu-layout.scss`**

```scss
// Home cover: large Regular headline, Bold subline, image block, round accent badge.

.hslu-cover {
  .post-title {
    margin-bottom: 0.5rem;

    @media (min-width: 768px) {
      font-size: 3rem;
      line-height: 1.15;
    }
  }

  .hslu-cover-subline {
    font-weight: 700;
    margin-bottom: 0;
  }

  .hslu-cover-media {
    position: relative;
    margin-top: 2rem;

    @media (min-width: 576px) {
      margin-top: 4rem;
    }
  }

  .teaser-image {
    display: block;
    margin-bottom: 1.5rem;
  }
}

.hslu-stoerer {
  display: none;

  @media (min-width: 576px) {
    position: absolute;
    top: 0;
    right: 2rem;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 11rem;
    height: 11rem;
    padding: 1rem;
    border-radius: 50%;
    background-color: var(--global-accent-color);
    color: var(--global-text-color);
    font-size: 0.75rem;
    line-height: 1.3;
    text-align: center;
  }
}
```

- [ ] **Step 5: Run check**

Expected on `/`: `colourCount: 0`, `weightCount: 0`, `horizontalOverflow: false` at all widths. Plus evaluate on `/` at 1280: `getComputedStyle(document.querySelector('.hslu-cover .post-title')).fontWeight === '400'`, `.hslu-cover-subline` → `'700'`, `.hslu-stoerer` visible and its text fully inside the circle (`scrollWidth <= clientWidth`); at 375: `.hslu-stoerer` not visible.

- [ ] **Step 6: Commit**

```bash
git add _layouts/about.liquid _pages/about.md _sass/_hslu-layout.scss
git commit -m "Add HSLU cover layout and Störer badge to the home page"
```

---

### Task 6: Docs, visual review, code review

**Files:**
- Modify: `README.md` (short section after the badge block)

- [ ] **Step 1: README** — insert after the closing `</div>` of the header block:

```markdown
## IRC site design

This fork follows the HSLU corporate design (logo, colours, typography). Rules and decisions are in
`docs/superpowers/specs/2026-10-07-hslu-cd-redesign-design.md`; overrides live in `_sass/_hslu.scss` and `_sass/_hslu-layout.scss`.
Key rules: text is always black, accents (`#77c5d8` etc.) only as fills with black text, Regular/Bold
only, HSLU logo unmodified top-left. FS Albert Web may replace Verdana only once HSLU M&K approves hosting.
```

- [ ] **Step 2: Final check** — full harness; all expectations from Tasks 1–5 hold. `wc -l _sass/_hslu.scss _sass/_hslu-layout.scss` each < 300.

- [ ] **Step 3: Screenshots for the user** — with Playwright MCP, full-page screenshots of `/`, `/projects/`, `/RedirectedWalking/`, `/publications/` at 1280 and 375 into `$S/screens/`. Hand them to the user with this checklist (user judges, not the agent):
  1. Logo top-left, unmodified, enough breathing room?
  2. Addition reads as department + IRC, aligned to the logo's bottom?
  3. Page feels white-dominant with only sparse blue accents?
  4. Headline vs subline hierarchy clear without extra weights?
  5. Störer badge readable and not covering important image content?
  6. Footer: "FH Zentralschweiz" visible, links findable?
  7. Mobile: header compact, nothing cut off?

- [ ] **Step 4: Code review** — dispatch `feature-dev:code-reviewer` on `git diff main...hslu-cd-redesign` with the spec path; fix confirmed findings, re-run harness.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Document HSLU design rules in README"
```
