# Mobile UX Audit — Proplead Frontend

**Date:** 2026-05-25
**Auditor:** Claude (driving real Chrome at viewport ≈386×735, DPR 2 — iPhone-class mobile)
**Target:** proplead.io (production) — `/landingV2` + all customer-facing app routes (auth + auth'd)
**Excluded by scope:** `/` and `/landingV3` landings; `/usuarios`, `/uso`, `/onboards`, `/admin/*`, `/_internal/*`; redirect-only routes.
**Deliverable:** This report. **No code was changed.** Implementation happens in a follow-up after triage.

---

## Executive summary

The app is broadly **desktop-first**. Three pages (`/anuncios`, `/suscripcion`, and the `/landingV2` hero) ship with **document-level horizontal scroll** on iPhone-class viewports — content is physically unreachable without a side-scroll the user shouldn't have to do. Several other pages are technically within the viewport but contain cards whose internal contents (chat bubbles, action buttons, badges) bleed past their container's right edge.

There is no dedicated mobile component variant for any data-dense surface (Leads list, Listings list, Conversations table, Subscription dashboard, Alerts log). The same desktop grids/tables are forced into mobile width with `truncate` and `overflow-x-auto` as the only adaptations.

### Top 5 critical (P0) issues to fix first

| # | Page | Issue | Why P0 |
|---|------|-------|--------|
| 1 | `/anuncios` | 119 px horizontal page overflow; listing cards clip action buttons (`No cualifi…`, `Cualific…`), metric chips, and Fotocasa badge | Primary work surface; users cannot click the qualify/disqualify CTAs |
| 2 | `/suscripcion` | 133 px horizontal page overflow; "BALANCE DE CONVERSACIONES" card clips the buy-pack counter and the orange "Comprar" CTA | Revenue page — broken purchase UI |
| 3 | `/conversaciones` (open thread) | Every message bubble's text overflows its container card's right edge (e.g. `…en`, `…1070704`, `…junio`, `…Fech`) | Core daily-use feature; users literally cannot read the last 1–2 chars of every line |
| 4 | `/leads` | State tabs (`Todos / No cualificados / Sin respuesta / Cualificados / Rechazados`) force horizontal scroll inside the page — hidden tabs are invisible | Primary navigation between lead segments is broken |
| 5 | `/landingV2` hero | `h1` uses `text-5xl` (48 px) on mobile; the word "desinteresados" extends past the right edge of the viewport | First impression on the marketing page |

### Effort estimate to fix everything

- **P0 cluster (5 issues):** ~1.5 days of focused work — most fixes are responsive-grid + breakpoint tweaks on shared components.
- **P1 (12 issues):** ~2 days — mostly per-page card-layout adjustments and a small set of new mobile-only sub-components (e.g. mobile state-tab grid, mobile alert card).
- **P2 (8 issues):** ~0.5 day — polish.

**Reusable patterns identified** (build once, reuse):
- `MobileSegmentedGrid` — replaces `overflow-x-auto` tab strips with a wrapping 2-row pill grid (used in Leads state tabs, Conversaciones sub-tabs, potentially Suscripción mensual/anual)
- `MobileCardActionBar` — collapses the "row of action buttons + icon buttons" pattern used in Listings and Lead cards into a vertical stack on `<sm`
- `MobileTableCard` — converts a desktop table row into a stacked card on mobile (Alertas log, Historial table, Equipo members table)

---

## Heuristic findings (cross-cutting)

These are not single-page bugs — they're patterns that recur and should be addressed in one shared change rather than per-page.

### H1. Horizontal page overflow on data pages (P0)

`/anuncios` and `/suscripcion` produce `document.documentElement.scrollWidth > window.innerWidth` on mobile. The root cause in both cases is **fixed-width inner rows**: a row of metric chips or a row of input/button pairs is built as a flex row with `min-width` content that doesn't drop below ~500 px. Whenever the viewport is narrower than the row's natural width, the row pushes the entire page wide.

**Fix pattern:** wrap these rows in `flex-wrap` or convert to `grid-cols-2 sm:grid-cols-4`. Audit for `min-width`, `whitespace-nowrap`, and absent `flex-wrap` on flex containers under `[data-page="leads"|"anuncios"|"suscripcion"]`.

### H2. Cards that *fit* the viewport but whose *contents* don't (P0)

This shows up most painfully in `/conversaciones` (open thread) — the message bubble's outer card has correct margins, but the `<p>` inside uses a wider width than the bubble. Same shape in some listing card metric tiles.

**Fix pattern:** message text containers need `min-width: 0` on their flex parent and `overflow-wrap: anywhere` (or at least `break-word`) on the text node. URL strings (e.g. `https://www.idealista.com/inmueble/111333534`) require `word-break: break-all` or `overflow-wrap: anywhere` because they have no natural break points.

### H3. Whole row/card is visually one tap target but only the title is clickable (P1)

Confirmed by the user on `/conversaciones` (only the lead name opens a thread; tapping date/phone does nothing). Likely also true in Dashboard's "Leads más recientes" cards (only `Ver detalles →` tappable) and Lead cards on `/leads` (only the `Consent` text-link tappable).

**Fix pattern:** wrap the entire card surface in a `<button>` or `<Link>` with `role=link`, and stop nested links from claiming inner taps (`stopPropagation` on the trash icon, etc.). For accessibility, keep keyboard focus order sensible.

### H4. Desktop tabs/segmented controls forced into mobile width via `overflow-x-auto` (P0/P1)

`/leads` tab strip and likely `/conversaciones` sub-tabs. The DOM contains all options, but the user can only see ~3 and has to swipe; there's no visual affordance hinting that more options exist beyond the right edge.

**Fix pattern:** below `sm`, render a `flex-wrap` (chip-style) or a `grid grid-cols-2` of pills. User explicitly endorsed a "3×2 grid" layout for Leads state tabs.

### H5. Touch targets under 40×40 px (P1)

Common in: hamburger menu close-buttons, "Ver todos" header links, "Ver detalles →" lead row CTAs, "Consent" link, trash icons on lead cards, footer legal links (`TÉRMINOS PRIVACIDAD COOKIES` on `/login`).

**Fix pattern:** raise hit-area to 44×44 (Apple HIG) using `before:` or by increasing padding. Trash icons on destructive actions need *more* space and ideally a confirmation step on mobile.

### H6. Section anchors hidden behind sticky `/landingV2` header (P1)

Section h2's like "Empieza a recibir leads cualificados de forma automática en pocos pasos" get covered by the sticky pill header on mobile because the section's `scroll-margin-top` is set for desktop (`scroll-mt-28` ≈ 112 px) but the mobile sticky pill is taller in proportion to viewport.

**Fix pattern:** `scroll-mt-32 sm:scroll-mt-28` on `<section>` elements, or measure the actual sticky-header height with a CSS var.

### H7. Long legal documents have no in-page navigation (P2)

`/legal/terms` is 10,371 px tall on mobile — 14+ scroll viewports — with no TOC, anchor index, or "back to top" affordance.

**Fix pattern:** Add a collapsed `<details>` TOC at top, or a sticky chapter indicator.

### H8. Filter dropdowns sometimes have inconsistent or duplicate labels (P1)

`/historial` shows two filters both labeled "ORIGEN:" — almost certainly a copy/paste bug (one is likely meant to be "RESULTADO" or "USUARIO"). `/conversaciones` filter grid appears to show "ANUNCIO" twice across two rows (the icons differ but the label is identical) — needs code review.

**Fix:** code-side label cleanup, no design work needed.

---

## Page-by-page findings

For each page I quote the JS-level measurement (`W` = viewport width, `docW` = document width, `hOverflow` = horizontal scroll present). Production was tested at W=386, H≈735, DPR 2.

### `/landingV2` — Marketing landing (public)

`W=386 / docW=380 / docH=10068 / hOverflow=false` at document level, but visual content clips.

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| LV2-1 | **P0** | Hero `h1` "leads desinteresados" clips the right edge of the viewport. `h1` uses `text-5xl lg:text-7xl` — 48 px on mobile, which is wider than 386 px for the word "desinteresados" alone | Change to `text-3xl sm:text-4xl md:text-5xl lg:text-7xl`, or shorten copy | [src/pages/MarketingLanding.tsx](src/pages/MarketingLanding.tsx) |
| LV2-2 | **P0** | The sticky top header pill ("Proplead logo + Iniciar sesión + Empezar ahora") consumes ~140 px vertical and overlays content on every scroll. The logo gets visually squashed | On `<sm` collapse to a thinner top bar; show only one CTA, demote "Iniciar sesión" to text link | [src/pages/MarketingLanding.tsx](src/pages/MarketingLanding.tsx) |
| LV2-3 | P1 | Section headings get hidden under the sticky header on scroll (`Empieza a recibir leads cualificados…`, `Recibe al instante los leads cualificados`) | Increase `scroll-mt-*` for mobile breakpoints on each `<section>` (see H6) | same |
| LV2-4 | P2 | "Recibe al instante…" section renders the heading twice (large faded yellow + smaller bold below) — likely an intended visual effect but reads as a duplicate on mobile | Either suppress the ghost heading at `<sm` or shrink it considerably | same |
| LV2-5 | P2 | The feature-list section ("Revisa conversaciones / Analiza y filtra / Acciona en grupo / Revisa métricas") shows the 3 inactive items at very low opacity on the orange background — barely readable on mobile | Raise inactive-state opacity floor at `<sm`, or stack all four items at equal weight | same |

Otherwise the landing reads well, the pricing tiers stack cleanly, and the FAQ accordions/footer are fine on mobile.

---

### `/dashboard` — Main dashboard (auth)

`W=386 / docW=371 / docH=2557 / hOverflow=false`. No page-level overflow.

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| D-1 | P1 | **User-reported, confirmed:** `FECHA:` filter pill renders ~350 px wide while `ANUNCIO:` pill renders ~280 px wide; they should match | Same parent grid (`grid-cols-1 gap-3`) and `w-full` on both pills, or both as `grid grid-cols-1 sm:grid-cols-2` items | [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) |
| D-2 | P2 | "Ver todos →" link in "Leads más recientes" header is 84×20 — well below the 40 px touch target floor | Add padding to the link; consider whole-header-row tappable | same |
| D-3 | P1 | Each recent-lead card is tappable only via "Ver detalles →" (small text link). User expects the whole card to be tappable | Wrap card body in a `<Link>` and contain the trash button click with `stopPropagation` | same |
| D-4 | P2 | KPI cards stack vertically with large empty space on mobile (24 % → 71 % → 111 →…). Functional, but could use a 2-col mini-grid for the percentage KPIs to reduce scroll burden | Optional: `grid-cols-2 sm:grid-cols-3` for percent KPIs | same |

---

### `/leads` — Lead database (auth)

`W=386 / docW=371 / docH=157,979 / hOverflow=false`. Heaviest page in the app (703 leads × ~225 px each = ~158 k px of stacked cards, no virtualization).

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| L-1 | **P0** | **User-reported, confirmed:** state-tab strip (`Todos / No cualificados / Sin respuesta / Cualificados / Rechazados`) is a `max-w-full overflow-x-auto no-scrollbar` flex row 572 px wide inside a 339 px container. Hidden tabs have no visible affordance | At `<sm`, render as `grid grid-cols-3 gap-2` of pill buttons (2 rows × 3 cols). **User explicitly endorsed this layout.** | [src/pages/Leads.tsx](src/pages/Leads.tsx) |
| L-2 | P1 | **User-reported, confirmed:** "✓ SELECCIONAR TODOS" renders as a full-width prominent yellow button — too loud on mobile when the user isn't in bulk mode | At `<sm` render as a small text-button (e.g. ghost variant), or hide entirely and surface inside a bulk-select chevron | same |
| L-3 | P1 | **User-reported, confirmed:** "⚙ COLUMNAS: 12/18" pill is visible on mobile but column visibility is meaningless when leads render as cards | **User-recommended option A:** the toggled-on column keys inject extra rows of metadata into the card. **Option B (simpler):** hide the COLUMNAS pill entirely on `<sm` | same |
| L-4 | P1 | Red trash icon (top-right of every lead card) is a small touch target right next to the multi-select checkbox — easy mis-tap for a destructive action | Move trash inside an overflow menu (`⋯`), require a confirmation tap | same |
| L-5 | P1 | Only the `Consent` text link inside each card is tappable; the rest of the card body doesn't open the lead detail | Same fix as D-3 — wrap card in `<Link>` | same |
| L-6 | P2 | Page renders all 703 cards inline — slow on mobile (long scroll, many DOM nodes, jank). Out of scope for a pure-mobile audit but flagged for awareness | Virtualize the lead list with `@tanstack/react-virtual` or react-window. Probably worth doing as part of mobile pass since mobile pays more for DOM weight | same |

---

### `/anuncios` — Listings (auth)

`W=386 / docW=505 / docH=? / hOverflow=true` ← **page-level horizontal scroll, 119 px overflow**

The horizontal-overflow JS sweep found **104 elements** with `getBoundingClientRect().right > viewport`. Many are nested duplicates of the same overflowing card row.

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| A-1 | **P0** | **User-reported, confirmed:** listing card contents (metric chips `Conversaciones / Cualificados / % Respuesta`, action buttons `No cualificar / Cualificar`, Fotocasa badge) extend past the right edge. This is what causes the page-level overflow | The card uses a flex row of fixed-width children without `flex-wrap`. Convert metric chips to `grid grid-cols-2 sm:grid-cols-4 gap-2`; stack action buttons vertically on `<sm`; allow the Ref/ID/Fotocasa badge row to wrap | [src/pages/Listings.tsx](src/pages/Listings.tsx) |
| A-2 | P1 | Address line truncates mid-word (`…Andalu`). Span has `truncate` class | Replace `truncate` with `line-clamp-2`, or display full address and let it wrap | same |
| A-3 | P1 | Search input placeholder truncates (`…direc`). Field is full-width; the placeholder is just too long | Shorten placeholder copy for mobile (`Buscar título o ID…`) or display field above + condensed icon-only on small screens | same |
| A-4 | **P0** | **User-reported, confirmed (Nuevo Anuncio modal):** `Precio *` / `Metros (m²) *` / `Habitaciones *` are laid out as 3 columns. Because the labels have different lengths, the labels wrap to different numbers of lines (`Precio` = 1 line, `Metros (m²)` = 2 lines, `Habitaciones` = 1 line), so the input boxes start at different vertical positions | At `<sm`, stack as `grid-cols-1` (one input per row) — or force labels to 2 lines and align inputs with `mt-auto`. Stacked is the cleaner mobile choice | [src/components/listings/ListingFormModal.tsx](src/components/listings/ListingFormModal.tsx) (or wherever the Nuevo Anuncio form lives) |
| A-5 | P1 | "Identificador" placeholder also truncates (`Ej: Piso 2 habitaciones en Fu`) | Shorter placeholder or larger modal width | same |
| A-6 | P2 | Modal does not cover full viewport — Anuncios card content visible at the bottom behind the modal | At `<sm` use a full-screen sheet rather than centered dialog | same |

---

### `/conversaciones` — Conversation inbox (auth)

`W=386 / docW=371 / docH=816 / hOverflow=false` (list view). When a thread is open, the URL doesn't change but a slide-over panel takes over the viewport.

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| C-1 | **P0** | **User-reported, confirmed:** inside an open thread, message text overflows the chat bubble card. Examples observed: `…de`, `…en`, the entire idealista URL `…111333534`, `…junio`, `…vivir`, `…(menos de 2`, `…Fech` | Two root causes likely: (1) the bubble's flex parent needs `min-width: 0` to allow shrink, (2) long URLs/words have no break point — add `overflow-wrap: anywhere` (or `break-words` Tailwind class) on the text element | [src/pages/Conversations.tsx](src/pages/Conversations.tsx) + bubble component |
| C-2 | P1 | Top right "Download" icon in the open-thread header is half-clipped | Header buttons row needs `flex-shrink` semantics; consider moving Download into an overflow menu on mobile | same |
| C-3 | P1 | **User-reported, confirmed:** in the conversation list, only the lead name is tappable to open a thread. Tapping the phone number, date, status badge, or empty area does nothing | Wrap the entire row's interactive area in one `<button>` / `<Link>`, with `e.stopPropagation()` on the trash icon | same |
| C-4 | P1 | The 6-filter grid above the conversation list shows what appears to be two filters labeled `ANUNCIO:` (rows 1 and 2). Icons differ but labels match — possible duplicate label bug | Verify in code which two filters those are; rename the second to its actual semantic (`CANAL`, `ORIGEN`, etc.) | same |
| C-5 | P2 | "LEADS" / "NO IDENTIFICADOS" primary tab + "TODOS / OPT-OUT / ACTIVOS" sub-tab + 6-filter grid + search field eat ~50 % of mobile viewport before the actual conversation list shows. Consider collapsing filters into an accordion on `<sm` | same |

---

### `/onboarding` — Onboarding wizard (auth)

`W=386 / docW=371 / docH=4258 / hOverflow=false`. **Generally clean on mobile.**

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| O-1 | P2 | Step headings ("Conectar WhatsApp Business") wrap to 3 lines on the narrow card width because the numbered badge takes ~40 px on the left | Reduce gap between badge and heading, or use `text-base` instead of `text-lg` for step headings at `<sm` |
| O-2 | P2 | "Guía de reenvío de correos (Idealista)" callout has multi-step content with long line wraps; readable but visually busy | Optional: smaller monospace font for the boxed email address |

---

### `/connect-whatsapp` — Connection status (auth)

`hOverflow=false`. Minimal page (one status card). No issues.

---

### `/alertas` — Alert log (auth)

`W=386 / docW=371 / docH=32,410 / hOverflow=false` at document level.

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| AL-1 | P1 | "Log de alertas" table renders with `FECHA / SEVERIDAD / ASUNTO` columns; on mobile the ASUNTO column truncates so heavily that only `Sy…` and `ID: …` are visible — users can't tell what alert each row is for | Convert the table to a stacked card list on `<sm` using the `MobileTableCard` pattern from H1 fix family |
| AL-2 | P2 | The "Estado de alertas configuradas" card shows "Cargando…" inline with the data — the placeholder doesn't anchor cleanly on mobile | Show a skeleton block instead of inline text |

---

### `/configuracion` — Org settings (auth)

`hOverflow=false`. Form layout stacks vertically. Largely fine.

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| CFG-1 | P2 | "Guardar" button next to the "Nombre de la Inmobiliaria" input is narrow; could be wider or moved below input | Move below input at `<sm` |

---

### `/equipo` — Team management (auth)

Captured header + invite CTA + "Activos/Pendientes" mini-KPIs + start of member table. Did not scroll the full member list — but the `USUARIO / ROL` table header visible suggests the same desktop-table pattern that fails on Alertas/Historial. Flagging as suspected-P1 pending verification.

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| E-1 | P1 (suspected) | Member table likely has the same column-truncation issue as Alertas | Apply `MobileTableCard` pattern |

---

### `/historial` — Audit log (auth)

`hOverflow=false`. Empty state in this org (no records).

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| H-1 | P1 | Filter section shows **two filters both labeled `ORIGEN:`** (rows 1 and 3). Same icon styling, both default to `Todos`. Almost certainly a copy/paste bug — one should be a different field (`RESULTADO`, `USUARIO`, etc.) | Code-side label cleanup |

---

### `/botTest` — Internal bot tester (auth)

Internal-feeling but exposed to authed customers. Single textarea + dropdown + button. Clean.

---

### `/email-templates` — Email gallery (auth)

`W=386 / docW=371 / docH=3418 / hOverflow=false`. Gallery of preview cards. The category tabs (`WELCOME / LOW BALANCE / PAYMENT FAILED`) wrap cleanly. No issues.

---

### `/suscripcion` — Subscription (auth)

`W=386 / docW=519 / hOverflow=true` ← **page-level horizontal scroll, 133 px overflow**

| ID | Sev | Issue | Recommended fix | File |
|---|---|---|---|---|
| S-1 | **P0** | "BALANCE DE CONVERSACIONES" card contains a 2-column inner layout — left side has the conversation balance, right side has the "COMPRA PACK" buy widget (`AÑADIR PACK`, `– 1 +` counter, orange "Comprar" CTA). The right side is fully clipped on mobile: only `COMPRA PL…`, `AÑADIR PACK…`, partial counter, and a fragment of the orange button (`C…`) are visible | At `<sm` stack the two halves vertically — `flex-col sm:flex-row` on the card root | [src/pages/Subscription.tsx](src/pages/Subscription.tsx) |
| S-2 | P1 | The "USA ESTE SIMULADOR…" dark calculator card fits well; "Mensual / Anual −15 %" toggle works. Pricing tier cards (Free / Plus / Pro / Pro+ / Enterprise) stack as expected and are individually OK | Nothing to fix on the calculator; ensure page-level overflow goes away once S-1 is resolved | same |

---

### `/login`, `/signup`, `/email-preferences` — public auth pages

`hOverflow=false`. Card-centered layouts that fit mobile cleanly. `/signup` and `/email-preferences` show their no-token error states (as expected — token required from a real invite/preferences link).

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| AUTH-1 | P2 | "TÉRMINOS · PRIVACIDAD · COOKIES" tiny links at the bottom of `/login` (font-size ~12 px, height ~16 px) | Raise font-size to 14 px and add vertical padding |

---

### Legal docs (`/legal/terms`, `/privacy-policy`, `/cookies`, `/aup`, `/data-deletion`, `/aviso-legal`, `/legal/deletion-status`)

All confirmed `hOverflow=false`. Long-form readable text. The biggest doc (`/legal/terms`) is 10,371 px tall on mobile.

| ID | Sev | Issue | Recommended fix |
|---|---|---|---|
| LEG-1 | P2 | No in-page navigation / TOC / back-to-top affordance on legal docs | Add a collapsed `<details>` TOC at top, or a sticky chapter index |

---

## Prioritized fix plan

### Tier 0 — Ship first (P0 cluster, ~1.5 day)

These are the issues that make pages actively broken on mobile.

1. **Fix `/anuncios` horizontal overflow** — convert listing card's metric row + actions row to `grid-cols-2 sm:grid-cols-4` + `flex-col sm:flex-row` (issue A-1)
2. **Fix `/suscripcion` horizontal overflow** — stack the BALANCE DE CONVERSACIONES card halves vertically on `<sm` (S-1)
3. **Fix conversation message overflow** — add `min-w-0` on message bubble's flex parent + `break-words` (and `overflow-wrap: anywhere` for URLs) on the text node (C-1)
4. **Fix `/leads` state tabs** — render as `grid grid-cols-3 gap-2` of pills at `<sm`, replacing the horizontal-scroll strip (L-1)
5. **Fix landing hero clipping** — `text-3xl sm:text-4xl md:text-5xl lg:text-7xl` on the h1 (LV2-1)
6. **Fix Nuevo Anuncio inputs** — stack `Precio / Metros / Habitaciones` as `grid-cols-1` at `<sm` (A-4)

### Tier 1 — Polish the high-traffic surfaces (P1 cluster, ~2 days)

7. **Dashboard FECHA/ANUNCIO filter width parity** (D-1)
8. **Make whole row tappable** — Conversations list, Lead cards, Dashboard recent-lead cards (C-3, L-5, D-3)
9. **Subtler "Seleccionar todos" + hide COLUMNAS at `<sm`** on Leads (L-2, L-3)
10. **Section-anchor scroll offset on landingV2** so headings aren't covered by sticky header (LV2-3)
11. **Sticky header diet on landingV2** — single CTA + thinner bar on `<sm` (LV2-2)
12. **Convert Alertas log to card list at `<sm`** + likely the same for Equipo and Historial when populated (AL-1, E-1)
13. **Fix duplicate "ORIGEN" filter label on `/historial`** + verify duplicate "ANUNCIO" on `/conversaciones` filter grid (H-1, C-4)
14. **Anuncios address `truncate` → `line-clamp-2`** and search placeholder copy (A-2, A-3)
15. **Touch-target floor 44×44** on all `<a>` / `<button>` elements identified by the JS sweep — `Ver todos`, `Ver detalles`, `Consent`, footer legal links (H5)

### Tier 2 — Nice-to-have polish (P2 cluster, ~0.5 day)

16. LandingV2 ghost-heading suppression at `<sm` (LV2-4)
17. LandingV2 inactive feature list contrast bump (LV2-5)
18. Onboarding step heading wrap tightening (O-1)
19. Legal docs in-page TOC (LEG-1)
20. Dashboard percentage KPIs in a 2-col mini-grid (D-4)
21. Configuration "Guardar" button below input on `<sm` (CFG-1)
22. Login footer link sizes (AUTH-1)

### Tier 3 — Bigger structural work, separate task

23. Virtualize the `/leads` list (`@tanstack/react-virtual`) — currently renders 700+ cards inline (L-6)
24. Build the three reusable mobile-pattern components — `MobileSegmentedGrid`, `MobileCardActionBar`, `MobileTableCard` — *before* doing the per-page fixes if scheduling allows, so each fix can use them

---

## Suggested execution order

1. Build the three shared mobile-pattern components (Tier 3, item 24) — pays back across every Tier 0 and Tier 1 fix.
2. Tier 0 cluster (six items, in the order listed).
3. Tier 1 cluster.
4. Tier 2 polish in a final pass.
5. Defer Tier 3, item 23 (Leads virtualization) to its own task — it's larger and has different risk surface (scroll behavior, sticky filters).

After Tier 0 + Tier 1 ship, re-run this same audit (same script, same viewport) to verify zero `hOverflow=true` pages and zero touch-target violations under 40 px on customer-facing routes.

---

## Audit method notes & caveats

- **Browser:** real Chrome on macOS via the `Claude for Chrome` extension, paired with this session.
- **Viewport:** physical window resized to 386×735 (Chrome window chrome adds 11 px to the requested 375; CSS-pixel layout reflects iPhone SE-class width).
- **Authenticated routes** were tested in the user's already-logged-in session — no credentials were transmitted.
- **What I did *not* test:** image lazy-loading behavior, scroll-tied animations (some screenshots above showed empty space when an Intersection Observer animation hadn't yet fired — re-running with `scroll-behavior: auto` made content render correctly), real device touch / hover differences, slow-network throttling.
- **What I did *not* verify exhaustively:** every Equipo team row (only the table header), every alert row past the first ~4, every legal doc end-to-end, the populated state of the Historial table.
- **Excluded by user scope:** `/`, `/landingV3`, `/usuarios`, `/uso`, `/onboards`, `/admin/*`, `/_internal/*`, redirect-only routes.
