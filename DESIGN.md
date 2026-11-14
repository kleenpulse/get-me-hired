---
name: Get Me Hired (Dawn)
description: A calm, round, hue-free dashboard system. One white frame, tonal cards, one ink colour, and a dawn gradient for the day's main card.
colors:
  band: "#CFCCCD"
  sheet: "#FFFFFF"
  card: "#E7E6E9"
  card-nested: "#D1D3D7"
  lift: "#FFFFFF"
  slate: "#A9ACB6"
  dawn-1: "#D3DAE8"
  dawn-2: "#DDDEE2"
  dawn-3: "#E7E5DA"
  dawn-4: "#F4EAD0"
  foreground: "#0B1325"
  ink-2: "#4A4E58"
  ink-3: "#62666F"
  primary: "#0B1325"
  primary-foreground: "#FFFFFF"
  signal: "#D05251"
  signal-ink: "#A3302E"
  ok: "#1B6B45"
  ok-soft: "#D9EDE1"
  warn: "#7A4F00"
  warn-soft: "#F5E6C4"
  critical: "#A8261D"
  critical-soft: "#F7DCD9"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  caption:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  action:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.06em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  note: "8px"
  tile: "20px"
  card: "28px"
  frame: "34px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "14px"
  card: "20px"
  section: "28px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-slate:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.card-nested}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 20px"
  row:
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 14px 0 6px"
  row-selected:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "56px"
  stat-pill:
    backgroundColor: "{colors.card-nested}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 16px 0 5px"
  icon-chip:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    size: "46px"
  hook-note:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.note}"
    padding: "12px"
  label-published:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    height: "24px"
  label-pattern:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    height: "24px"
---

# Get Me Hired: Design System ("Dawn")

| | |
|---|---|
| Status | Draft v0.1 |
| Date | 2026-11-14 |
| Covers | Every screen in [FRD.md](FRD.md) §10, light and dark |
| Source | A smart-home dashboard concept, measured pixel by pixel ([Appendix A](#appendix-a-the-reference-measured)) |

The tokens in the frontmatter and in [Tokens as CSS](#tokens-as-css) are the rules. The prose explains how to apply them. Requirement IDs such as FR-6.2 point to [FRD.md](FRD.md).

## Overview

Dawn is a calm dashboard system for people who aren't technical and who open the app once a day to answer one question: "who do I write to now?" (FR-6.1). It takes its structure from one reference dashboard and changes whatever that reference gets wrong for this product.

**Five decisions shape everything:**

1. **One white frame, tonal cards.** The whole app sits in one rounded white frame. Cards are told apart by their fill, never by borders or shadows.
2. **One ink.** A single navy-black (`#0B1325`) is the text, the icons, the main button and the toggle knob. There is no brand colour.
3. **Selected means lighter.** The active row, tab or tile turns white and gains a soft shadow. Nothing is ever selected by turning a colour.
4. **Round to press, square to quote.** Things you press or read as one fact are pills and circles. Facts you quote in an email (hooks) are the only near-square shape.
5. **Colour is for meaning.** Hue appears only where the user must notice or act: fresh, verified, check first, failed.

**Two motifs come from the product, not from decoration:**

- **The dawn gradient.** A cool lavender that warms to cream, on the one card that holds the day's main action. The hunt is a morning ritual.
- **Dashed means unverified.** Anything the app couldn't confirm (a guessed address, an unknown age, unknown likes) has a dashed outline and no fill. The method's rule is "checked, not assumed", and the dashed line makes that visible.

### What Dawn keeps, changes and drops

| Reference | Dawn |
|---|---|
| White frame, 14px gutter equal to the frame padding | **Kept** |
| Radius ladder 34 / 28 / 20 / 8, pills and circles | **Kept** |
| Pearl, mist, white and slate surfaces | **Kept**, same hex values |
| Navy pill button with uppercase label | **Kept**, one per view |
| White selected row with soft shadow | **Kept** |
| Red "Live" dot | **Kept** as the fresh dot, and for a running hunt |
| Progress ring around a portrait | **Kept** as the freshness ring and the daily counter |
| Callout cards with leader lines | **Kept** for hook notes, onboarding and empty states |
| Icon-only rail | **Changed:** every item has a text label |
| White text on the slate card (2.27:1) | **Changed:** ink text on slate (8.17:1) |
| Grey captions `#67696D` (3.67:1 on mist) | **Changed:** `#4A4E58` (5.56:1 on mist) |
| 11px captions, 13px body | **Changed:** 12px and 14px minimum |
| Frosted glass over photos | **Changed:** plain translucent white over the gradient, with no blur |
| Photography, portraits, product renders | **Dropped:** the app loads nothing from other sites (NFR-2) and stores the minimum about people (§13) |

### Where each reference part lives in the app

| Reference part | Its job there | In Get Me Hired |
|---|---|---|
| Frame and icon rail | App shell | The same shell. A bottom bar on phones |
| "Rooms" card: gradient, rows, button at the bottom | Pick a scope, start the main action | **Day card:** today's counter, the groups of today's list, and **Run today's hunt** |
| Row with icon chip and count ("3 device(-s)") | One item in a pick-one list | Today's groups ("Fresh posts, 7 people"), providers, sources, past runs |
| Hero photo with "Live" pill and stat chips | Status at a glance | The Day card header: hunt status pill and count chips |
| Device card: title, subtitle, toggle | One thing you can switch | Source cards, provider cards, settings groups |
| Stat pills: chip, value, label | Facts about the thing | Lead facts: age, likes, round, pay, location |
| Slate card | The device in focus | The card that needs attention now: a hunt in progress, an interrupted hunt |
| Callouts on the vacuum | Explain an object | Hook notes on a lead. Annotated sample lead on Welcome |
| Pill slider with value | Set a level | Daily target, follow-up delay, spending cap |
| Round transport buttons | Quick actions | Copy address, open mail app, undo |
| Circled "i" | Help | "Why?" explanations for labels and warnings |

## Colors

### Roles

| Token | Light | Dark | Use |
|---|---|---|---|
| `--band` | `#CFCCCD` | `#05070D` | Behind the frame. Visible only on wide screens |
| `--sheet` | `#FFFFFF` | `#0B1325` | The frame, the rail, side panels, dialogs |
| `--card` | `#E7E6E9` | `#172036` | Default card ("pearl") |
| `--card-nested` | `#D1D3D7` | `#232D47` | Anything inside a card: stat pills, tags, secondary buttons ("mist") |
| `--lift` | `#FFFFFF` | `#313C5A` | Selected rows, icon chips, hook notes, board tiles |
| `--slate` | `#A9ACB6` | `#414B66` | The one attention card per screen |
| `--dawn` | `#D3DAE8` → `#DDDEE2` 30% → `#E7E5DA` 65% → `#F4EAD0` | `#1D2746` → `#252B40` → `#302E34` → `#3B3128` | The Day card and the wizard card. Top to bottom |
| `--foreground` | `#0B1325` | `#EEF0F5` | Text and icons |
| `--ink-2` | `#4A4E58` | `#B4BAC8` | Secondary text, captions |
| `--ink-3` | `#62666F` | `#8C93A5` | Placeholders, dashed outlines, the off-state knob. Never body text |
| `--border` | `rgb(11 19 37 / 0.12)` | `rgb(238 240 245 / 0.12)` | Hairlines |
| `--primary` | `#0B1325` | `#EEF0F5` | Main button, toggle knob, tier A chip |
| `--primary-foreground` | `#FFFFFF` | `#0B1325` | Text on `--primary` |
| `--glass` | `rgb(255 255 255 / 0.6)` | `rgb(238 240 245 / 0.1)` | Chips on the dawn and slate cards |
| `--ring` | `#0B1325` | `#EEF0F5` | Focus ring |

### Meaning colours

Each one has exactly one meaning. Each is always paired with an icon and a word, so nothing depends on colour alone.

| Token | Light | Dark | Means | Appears as |
|---|---|---|---|---|
| `--signal` | `#D05251` | `#E4716F` | Happening now, and hours matter | A dot or a ring. Never text, never a fill |
| `--signal-ink` | `#A3302E` | `#F29A97` | The same, when it must be text ("4h old") | Text |
| `--ok` / `--ok-soft` | `#1B6B45` / `#D9EDE1` | `#6CCB98` / `#16382B` | Confirmed | Published label, key test passed, Replied, Call and Offer counts |
| `--warn` / `--warn-soft` | `#7A4F00` / `#F5E6C4` | `#E6B655` / `#3A2E12` | Check before you act | Pattern label, "Verify before sending", follow-up due, storage warnings, cap nearly reached |
| `--critical` / `--critical-soft` | `#A8261D` / `#F7DCD9` | `#F28B83` / `#42201E` | Failed, or can't be undone | Key errors, provider down, Delete everything |

### Rules

1. **Hue budget.** A screen in its resting state shows no hue except fresh dots and contact labels. If a third coloured thing appears, it must be one of the meanings above.
2. **Coral is a dot or a ring.** Red text or a red outline always means `--critical`. This keeps "fresh" and "failed" apart by shape as well as shade.
3. **The fresh dot sits on white.** On mist it reaches only 2.80:1. Inside a mist pill, put it in a white chip, as the reference does with its "Live" pill.
4. **Slate carries `--foreground` only.** Secondary text fails on it (3.67:1). Put secondary content in a `--glass` or `--lift` chip.
5. **Meaning text sits on its own soft fill, or on sheet, card or lift.** Never directly on mist: `--ok` fails there (4.33:1), and one rule for all three is easier to keep.
6. **One dawn card and one slate card per screen, at most.**
7. **Dark theme follows the same ladder.** Each step up is lighter: sheet, card, nested, lift. The frame takes the reference's navy. The main button flips to pale with navy text.

All pairs above were computed against WCAG 2.2. The numbers are in [Appendix B](#appendix-b-contrast-results).

## Typography

| Family | Use | Licence |
|---|---|---|
| **Figtree** (variable, 300–900) | All interface text | SIL OFL 1.1 |
| **Geist Mono** | Email addresses, URLs, post IDs, reason codes | SIL OFL 1.1 |

The reference uses one geometric sans for everything. Figtree is the closest open-licence face that stays readable at 12px and has tabular figures. Addresses are set in a mono face for a practical reason: in a geometric sans, `l`, `I` and `1` look alike, and the user copies these addresses into real emails.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 28 / 32 | 600, -0.01em | Wizard headings, the big counter ("6 of 20") |
| `title` | 18 / 24 | 600 | Card titles, company names |
| `label` | 14 / 20 | 600 | Row titles, values, secondary buttons |
| `body` | 14 / 22 | 400 | Sentences: what a company does, hooks, help |
| `caption` | 12 / 16 | 500 | Text under a title, pill labels, tags. In `--ink-2` |
| `action` | 12 / 16 | 700, uppercase, 0.06em | The primary button only |
| `data` | 13 / 20 | 400, mono | Addresses, URLs, IDs |

Rules:

- **Sizes are in `rem`.** The Text size setting (FR-10.5) sets the root to 100%, 112.5% or 125%. Controls use `min-height`, so they grow with the text.
- **12px is the floor.** Nothing is smaller, in any state.
- **Sentence case everywhere.** Uppercase is for the primary button alone, and that label is 4 words or fewer.
- **Numbers that line up or change** (counters, costs, ages, table columns) use `font-variant-numeric: tabular-nums`.
- **Two weights do most of the work:** 400 for sentences, 600 for names and values. 500 is for captions and 700 for the primary button.
- **Body lines stop at 68 characters.**
- **Inputs are 16px on phones,** so iOS doesn't zoom the page on focus.
- **Ship the Latin Extended subset.** Founders' names carry accents (for example "š", "ä", "ý"), and a fallback glyph in the middle of a name looks like a bug.

## Layout

### Shell

| Part | 1024px and up | Under 1024px |
|---|---|---|
| Frame | Floats on `--band` with a gutter-wide margin, radius 34px, max width 1600px | Fills the screen, radius 0 |
| Navigation | Left rail, 104px wide, on `--sheet`, no border | Bottom bar, 64px tall, 4 items plus "More" |
| Rail order | Today, Board, Draft checker, History. Then pinned to the bottom: Profile, Data and backup, Settings | Today, Board, Draft checker, More |
| Rail dividers | A 20px-wide hairline between groups, not between every item | None |

### Grid

| Width | Columns | Gutter | Card padding |
|---|---|---|---|
| 1024px and up | 4 | 14px | 20px |
| 640–1023px | 2 | 12px | 20px |
| Under 640px | 1 | 10px | 16px |

- **The frame padding equals the gutter.** The space between two cards and the space between a card and the frame edge are always the same.
- **Spans in a row add up to 4.** The reference uses 3 + 1 and 2 + 1 + 1.
- **Spacing steps:** 4, 8, 12, 14 (gutter), 20 (card), 28 (between sections in a card).
- **The row inset.** A row pill starts 14px from the card edge, and its icon chip starts 6px inside the pill. The chip therefore lines up with the card title at 20px. Keep that line.
- **Every screen works from 360px wide** (NFR-8).

### Screen recipes

**Today**, at 1024px and up:

```
┌──────┬────────────────────────────────────────────┬────────────────┐
│ rail │ [slate] Hunt in progress (only while it    │ [dawn] Today   │
│      │         runs or was interrupted)           │  ◔ 6 of 20     │
│      ├────────────────────────────────────────────┤  ● Hunted 08:12│
│      │ [pearl] Lead card 1: follow-up due         │ ────────────── │
│      ├────────────────────────────────────────────┤  Follow-ups  3 │
│      │ [pearl] Lead card 2: fresh post, tier A    │ (Fresh posts 7)│
│      ├────────────────────────────────────────────┤  Just raised 9 │
│      │ [pearl] Lead card 3 …                      │  Community   6 │
│      │                                            │                │
│      │ span 3, one column, in rank order          │ [RUN TODAY'S   │
│      │                                            │  HUNT]         │
│      │                                            ├────────────────┤
│      │                                            │ [pearl] Backup │
└──────┴────────────────────────────────────────────┴────────────────┘
```

- The ranked list is **one column**. Two columns would break the reading order of a ranked list.
- The Day card has the reference's "Rooms" anatomy: title and help, a hairline, pick-one rows, and the main button at the bottom. It stays in view while the list scrolls.
- Under 1024px the Day card becomes a strip at the top (counter, status, button). Its rows become a line of chips that scrolls sideways.

| Screen | Recipe | Dawn card | Slate card | Primary button |
|---|---|---|---|---|
| Welcome, Connect a provider, Your profile | No rail. One centred column, 560px max | The step card | None | CONTINUE |
| Today | 3 + 1, as above | Day card | Hunt in progress | RUN TODAY'S HUNT |
| Board | Columns are pearl cards, 300px wide, scrolling sideways. Leads are white tiles. Under 768px: a list grouped by status (FR-6.14) | None | None | None |
| Lead detail | Side panel, 480px, on `--sheet`. Full screen under 640px | None | None | MARK AS EMAILED, for the next person not yet emailed |
| Hunt | The slate card at the top of Today | Day card | The progress card | None while running. Cancel is a secondary button |
| Run report, History | One column of pearl cards, span 4. Runs are rows | None | None | None |
| Draft checker | 2 + 2: paste box, then the 6 checks | None | None | CHECK MY DRAFT |
| Settings, Data and backup | Two columns of pearl group cards | None | None | None. Changes save as they're made |

## Elevation & Depth

Dawn is flat. Depth comes from tone: band, then sheet, then card, then mist or lift.

| Token | Value (light) | Used by |
|---|---|---|
| `--shadow-lift` | `0 6px 18px -8px rgb(11 19 37 / 0.18)` | The selected row, a tile being dragged |
| `--shadow-overlay` | `0 24px 60px -20px rgb(11 19 37 / 0.35)` | Side panel, dialog, menu, toast |
| Scrim | `rgb(11 19 37 / 0.28)` | Behind a side panel or dialog |

- Cards have no shadow and no border.
- In the dark theme shadows barely show, so overlays also get a 1px `--border` line.
- **No `backdrop-filter` anywhere.** The reference blurs chips over a photo. Dawn's chips sit on a smooth gradient, so translucent white looks the same and costs nothing with 5,000 leads on screen (NFR-6).

## Shapes

| Radius | Token | Used by |
|---|---|---|
| 34px | `--radius-frame` | The app frame |
| 28px | `--radius-card` | Cards, the side panel's inner corners, dialogs |
| 20px | `--radius-tile` | The active rail tile, board tiles, banners, text areas |
| 8px | `--radius-note` | Hook notes and callouts |
| 999px | `--radius-pill` | Buttons, rows, pills, tags, single-line inputs, toggles, sliders |

- **Three shapes for three jobs.** Rounded rectangles hold things. Pills are pressed or read as one fact. Circles hold one icon or one letter.
- **The 8px note is the only near-square shape.** It marks text that is a quoted fact. A card's radius minus its padding gives the same number (28 − 20 = 8), so a note sits naturally in a card's corner.
- **Hairlines are 1px `--border`,** and appear in three places only: under a card header, between rail groups, and as leader lines from a callout.
- **Dashed, 1px, `--ink-3`:** unverified values. Nothing else is dashed.

## Components

Sizes are minimums. Every interactive part has these states:

| State | Treatment |
|---|---|
| Hover | One step on the tonal ladder (mist darkens slightly, a row gains `--glass`) |
| Pressed | Scale 0.98 |
| Focus (keyboard) | 2px `--ring` outline with a 2px gap in the ground colour |
| Selected | `--lift` fill, `--shadow-lift`, title stays `label` weight, `aria-current` or `aria-selected` set |
| Disabled | 45% opacity, no pointer events, and a caption that says why |

### Controls

| Component | Size | Spec |
|---|---|---|
| **Primary button** | 46px tall, pill | `--primary` fill, `action` text, optional 16px icon on the left. Full width in a narrow card. **One per view** |
| **Secondary button** | 46px tall, pill | Mist fill, `label` text, sentence case |
| **Quiet button** | 36px tall | No fill, `label` text, underline on hover. For "Why?" and "Undo" |
| **Destructive button** | 46px tall, pill | `--critical` fill with white text (7.09:1). Only inside a confirm dialog |
| **Icon button** | 44px circle | Mist fill, 20px icon. Always has a tooltip and an accessible name |
| **Toggle** | 42 × 26px, 20px knob | On: white track, `--primary` knob on the right. Off: mist track, `--ink-3` knob on the left. A visible "On" or "Off" caption sits beside it. On the sheet, where a white track would vanish, the track gains a 1px `--border` line |
| **Slider** | 60px tall, pill | The filled part is `--lift`, the rest is mist (`--glass` on the slate card). A 2px `--foreground` line is the handle. The value is written inside, in `label`. Arrow keys move it by one step |
| **Text input** | 46px tall, pill | `--lift` fill on a card, mist fill on the sheet. `--ink-3` placeholder. The label sits above, always visible |
| **Key field** | As text input | `data` font, hidden by default, with show, paste and Test buttons (FR-2.4) |
| **Text area** | Radius 20px | The Draft checker's paste box and lead notes |

### Pieces

| Component | Size | Spec |
|---|---|---|
| **Card header** | — | `title`, with an optional chevron when the title switches scope, and a `caption` under it. One trailing control: a toggle, a help button or a count. An optional hairline below |
| **Row** | 56px tall, pill | Icon chip, then `label` over `caption`, then a count or chevron. Used wherever one item is picked from a list |
| **Icon chip** | 46, 40 or 32px circle | `--lift` or `--glass` fill. Holds a 20px icon, or a company's first letter in `label` |
| **Stat pill** | 50px tall | Mist fill. A 40px white chip, then the value in `label` over its name in `caption`. Example: "4h old" over "Posted" |
| **Status pill** | 36px tall | White fill, optional 8px dot, `label` text. Example: "● Hunting…", "Hunted 08:12", "Not run today" |
| **Tag** | 28px tall | Mist fill, `caption` text, optional 14px icon. For the soft signals in §9.2 |
| **Unverified tag** | 28px tall | No fill, dashed outline, `--ink-2` text. For `pay-unknown`, `visa-unknown`, `guess-only`, "age unknown", "likes unknown" |
| **Hook note** | Radius 8px | `--lift` fill, 12px padding, `body` text, and the source link in `caption` below. Never editable, never drafted into an email |
| **Callout** | Radius 8px | A hook note with a 1px leader line to the thing it explains. Onboarding and empty states only |
| **Banner** | Radius 20px | Info: mist. Warning: `--warn-soft`. Failure: `--critical-soft`. Icon, one sentence in `--foreground`, one secondary button. For the states in §10.2 |
| **Toast** | 46px tall, pill | `--primary` fill, bottom centre. Carries "Undo" and a ring that drains over 10 seconds (FR-6.13) |
| **Side panel** | 480px | `--sheet`, `--shadow-overlay`, scrim behind. Focus is trapped inside and Escape closes it |

### Product components

**Contact label** (FR-5.3). 24px tall pill with a 14px icon and the word. The word is never hidden.

| Label | Fill | Text and icon | Outline | Icon | Beside it |
|---|---|---|---|---|---|
| Published | `--ok-soft` | `--ok` | None | Check | A link to the page it was found on |
| Pattern | `--warn-soft` | `--warn` | None | Two matching shapes | The example it was built from, and "Verify before sending" |
| Guess | None | `--ink-2` | Dashed | Question mark | "Verify before sending" |

**Freshness ring.** A 2px ring around a lead's 46px chip, showing how much of its window is left. It starts full and drains clockwise.

| Lead | Window | Ring colour |
|---|---|---|
| Fresh post | 24 hours | `--signal` |
| Funding round | 14 days | `--foreground` |
| Follow-up | Until its due date | `--foreground`, turning `--warn` when due |
| Age unknown | — | Dashed `--ink-3`, not drained |

The ring never stands alone. The age is always written beside it ("4h old", "round 4 days ago"), and the ring is hidden from screen readers.

**Tier chip** (§9.3). A 24px circle with the letter, labelled "Tier A" for screen readers. It uses the system's own ladder, with no hue.

| Tier | Fill | Letter |
|---|---|---|
| A | `--primary` | `--primary-foreground` |
| B | Mist | `--foreground` |
| C | None, 1px solid `--ink-3` outline | `--ink-2` |

**Lead card** (FR-6.2). A pearl card. From top to bottom:

1. **Header:** chip with freshness ring, company name in `title`, what they do in `body`, then the tier chip and a menu.
2. **Why it's here:** one `caption` line, for example "Fresh post, 4h old, tier A" (§9.4).
3. **Facts:** stat pills that wrap. Age, likes, round, role, location.
4. **Signals:** tags and unverified tags.
5. **Fit:** one `body` line.
6. **People:** one row per person. Name and role, the address in `data` with its contact label, then Copy, Open mail app and Mark as emailed. A marked person shows "Emailed 14 Nov" and a check. The section header shows "2 of 3 emailed" (FR-6.10).
7. **Hooks:** 1 to 3 hook notes.
8. **Sources:** links in `caption`.

When a post asked for a DM or a form, that method appears as a second row under the email, with the caption "What the post asked for" (FR-5.6).

**Board tile.** A white tile, radius 20px, 14px padding: company in `label`, role in `caption`, tier chip, and "2 of 3 emailed". A dragged tile gets `--shadow-lift`. A "Move to…" menu does the same by keyboard and on phones.

**Hunt steps** (FR-4.10). On the slate card: a list of plain steps, each with a 32px chip. Done shows a check. Running shows the coral dot. Waiting shows an empty ring. Failed shows the failure icon and its reason. Below: "Kept 14 · Dropped 31" in `label`, and a Cancel button. The list is a live region, so screen readers hear each step.

**Empty state.** A centred column of 360px at most: a small drawing made of system shapes, one `title` line, one `body` line, one button. The copy comes from §10.2. It never shows sample or invented leads.

## Do's and Don'ts

**Do**

- Tell cards apart by fill. Reach for pearl first.
- Keep one primary button per view, and give it a verb.
- Write the word next to every colour, ring and icon that carries meaning.
- Put a visible label on every rail item, toggle and input.
- Use the dashed outline for anything unverified, and for nothing else.
- Set addresses, URLs and IDs in the mono face.
- Keep touch targets at 44px or more.
- Check every new colour pair against the targets in Appendix B before merging.

**Don't**

- Don't add a brand colour, a coloured button or a coloured selected state.
- Don't put borders or shadows on cards.
- Don't put white text on slate, or secondary text on slate.
- Don't use coral for text, fills or errors. Don't use red for anything fresh.
- Don't use `backdrop-filter`.
- Don't load fonts, icons, logos, avatars or images from another site (NFR-2).
- Don't show company logos or people's photos, even if a page offers them.
- Don't go below 12px, and don't use uppercase outside the primary button.
- Don't animate anything while the system asks for reduced motion.
- Don't style a hook note like an input. Hooks are facts to read, and the app never writes the email (§4).

## Motion

Motion shows what changed and then stops. It only ever moves `transform` and `opacity`.

| What | How |
|---|---|
| Selected pill moving between rows, rail items or tabs | One shared element that slides. Spring, stiffness 350, damping 30. In plain CSS: 240ms |
| Hover, press, toggle knob | 150ms |
| Menus and tooltips | 120ms fade with scale from 0.96 |
| Side panel | In: 320ms, sliding 24px from the right while fading. Out: 160ms fade |
| Ring drawing in, counter changing | 600ms, once |
| A lead moving after a status change | 240ms |
| Lead cards arriving after a hunt | 40ms apart, first 8 only |
| Fresh dot on a running hunt | Opacity 1 to 0.4 and back, every 2 seconds. Still when no hunt runs |

- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` for everything that isn't a spring.
- **Reduced motion:** when the system asks for it, slides and springs become a 120ms fade, the dot stops pulsing, rings appear already drawn, and nothing staggers (NFR-1).
- **Long lists:** Today and Board draw only the rows on screen, and nothing animates layout.

## Icons, imagery and illustration

- **Icons:** [Lucide](https://lucide.dev) (ISC licence), bundled with the app. Outline only, 20px, 1.5px stroke, round ends. 16px inside buttons and 14px inside tags. Import only the icons used. No emoji as icons.
- **Companies and people** are shown as a first letter in a white chip. No logos and no photos: the app's security policy blocks other sites' images, and §13 keeps what's stored about people to a minimum.
- **Illustrations** are inline SVG built from the system's own shapes: pills, rings, chips and callouts with leader lines. The Welcome screen shows a sample lead card with callouts that explain "4h old, checked from the link" and "Published: written on their site". This is the reference's annotated vacuum, put to work.

## Tokens as CSS

Keep these in one file. Components read tokens and never hold a hex value. `data-theme` is `light`, `dark` or absent (follow the system).

```css
:root {
	color-scheme: light;

	--band: #cfcccd;
	--sheet: #ffffff;
	--card: #e7e6e9;
	--card-nested: #d1d3d7;
	--lift: #ffffff;
	--slate: #a9acb6;
	--dawn: linear-gradient(180deg, #d3dae8 0%, #dddee2 30%, #e7e5da 65%, #f4ead0 100%);
	--glass: rgb(255 255 255 / 0.6);

	--foreground: #0b1325;
	--ink-2: #4a4e58; /* 5.56:1 on --card-nested */
	--ink-3: #62666f; /* 3.84:1 on --card-nested: outlines and placeholders only */
	--border: rgb(11 19 37 / 0.12);
	--primary: #0b1325;
	--primary-foreground: #ffffff;
	--ring: #0b1325;

	--signal: #d05251; /* dot and ring only: 2.80:1 on --card-nested, so keep it on white */
	--signal-ink: #a3302e;
	--ok: #1b6b45;
	--ok-soft: #d9ede1;
	--warn: #7a4f00;
	--warn-soft: #f5e6c4;
	--critical: #a8261d;
	--critical-soft: #f7dcd9;

	--radius-note: 8px;
	--radius-tile: 20px;
	--radius-card: 28px;
	--radius-frame: 34px;
	--radius-pill: 999px;

	--gutter: 14px;
	--pad-card: 20px;

	--shadow-lift: 0 6px 18px -8px rgb(11 19 37 / 0.18);
	--shadow-overlay: 0 24px 60px -20px rgb(11 19 37 / 0.35);
	--scrim: rgb(11 19 37 / 0.28);

	--ease-out: cubic-bezier(0.22, 1, 0.36, 1);

	--font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "Geist Mono", ui-monospace, monospace;
}

[data-theme="dark"] {
	color-scheme: dark;

	--band: #05070d;
	--sheet: #0b1325;
	--card: #172036;
	--card-nested: #232d47;
	--lift: #313c5a;
	--slate: #414b66;
	--dawn: linear-gradient(180deg, #1d2746 0%, #252b40 30%, #302e34 65%, #3b3128 100%);
	--glass: rgb(238 240 245 / 0.1);

	--foreground: #eef0f5;
	--ink-2: #b4bac8;
	--ink-3: #8c93a5;
	--border: rgb(238 240 245 / 0.12);
	--primary: #eef0f5;
	--primary-foreground: #0b1325;
	--ring: #eef0f5;

	--signal: #e4716f;
	--signal-ink: #f29a97;
	--ok: #6ccb98;
	--ok-soft: #16382b;
	--warn: #e6b655;
	--warn-soft: #3a2e12;
	--critical: #f28b83;
	--critical-soft: #42201e;

	--shadow-lift: 0 6px 18px -8px rgb(0 0 0 / 0.5);
	--shadow-overlay: 0 24px 60px -20px rgb(0 0 0 / 0.7);
	--scrim: rgb(0 0 0 / 0.5);
}

@media (prefers-color-scheme: dark) {
	:root:not([data-theme]) {
		/* the same values as [data-theme="dark"] */
	}
}

@media (max-width: 1023px) { :root { --gutter: 12px; } }
@media (max-width: 639px) { :root { --gutter: 10px; --pad-card: 16px; } }
```

Notes for the build:

- **Fonts are self-hosted** as `woff2` in `assets/fonts/`, with `font-display: swap` and a preload for Figtree. The security policy needs only `font-src 'self'`.
- **Ring and slider values** are set as CSS custom properties from script (for example `--progress`). That works under a strict `style-src`. Don't write inline `style` attributes into static HTML.
- **In the dark theme the destructive button** uses `--critical` with navy text (7.76:1), since white text on it would fail.

## Appendix A. The reference, measured

The reference is a smart-home dashboard concept shot, 1174 × 852px. Colours were sampled from its pixels and sizes were measured from colour edges. Radii come from the diagonal distance into each corner, so they're accurate to about 2px. Font sizes are estimates. The image is someone else's work and isn't stored in this repo: Dawn takes its measurements, not its artwork.

| Element | Measured |
|---|---|
| Frame | White `#FFFFFF` on `#CFCCCD`, radius about 34px |
| Rail | 120px wide, white, no border. Icons only, about 20px, outline. A 20px hairline (`#D0D0D0`) between every item. Settings and avatar pinned to the bottom |
| Active rail tile | 58 × 58px, `#E7E6E9`, radius about 20px |
| Grid | 4 equal columns of about 249px. Gutter 14px. Frame padding 14px on every side, equal to the gutter |
| Rows | 448px and 362px. Spans 3 + 1, then 2 + 1 + 1 |
| Cards | 5 cards. Radius about 28px, no border, no shadow, 20px padding |
| Pearl card | `#E7E6E9` (2 cards, and the rail tile) |
| Slate card | `#A9ACB6`. Its lower sheet is `#B1B5BD` and its slider track `#BCBFC7` |
| Gradient card | Top to bottom: `#D3DAE8`, `#DDDEE2` at 30%, `#E7E5DA` at 65%, `#F4EAD0` |
| Mist | `#D1D3D7`: stat pills and the round pause button |
| Ink | `#0B1325` on the button and toggle knob. Text is near `#00010B`. Captions are near `#67696D` |
| Accent | One red dot, `#D05251`, in the "Live" pill. No other hue outside the photos |
| Primary button | 212 × 46px pill, navy, white uppercase label with wide tracking, plus icon |
| List row | 226 × 56px pill, 14px from the card edge. Selected: white with a soft shadow. A 46px chip sits 6px inside |
| Stat pill | 152 × 50px, mist, with a 40px white chip. 8px apart |
| Hero chips | 36px tall, translucent white over the photo, with a frosted look |
| "Live" pill | 78 × 36px, white |
| Toggle | About 42 × 28px, white track, 20px navy knob |
| Callout | 104 × 64px, white, radius about 8px, with 1px white leader lines |
| Slider | 214 × 60px pill. White fill, a 2px dark line as the handle, the value written on the unfilled side |
| Round button | 48px circle, mist |
| Progress ring | A thin arc with a dot handle around a circular image |
| Type | One geometric sans. About 18px for card titles, 13px for row titles and values, 11px for captions |

What it does well: one spacing value everywhere, a strict radius ladder, a single ink, selection by lightness, and almost no shadows. What it gets wrong for this product is in Appendix B.

## Appendix B. Contrast results

Targets: 7:1 for `--foreground`, 4.5:1 for `--ink-2` and meaning text, 3:1 for outlines, dots and `--ink-3`.

**The reference as drawn** (all below 4.5:1, and the reason for the changes in the Overview):

| Pair | Ratio |
|---|---|
| White title on the slate card | 2.27 |
| White value on the slider track | 1.84 |
| Caption on a stat pill | 3.67 |
| Caption on the gradient's top | 3.80 |
| Caption on pearl | 4.42 |

**Dawn, light:**

| Text | sheet | card | nested | slate | dawn (top / bottom) |
|---|---|---|---|---|---|
| `--foreground` | 18.52 | 14.90 | 12.35 | 8.17 | 13.19 / 15.45 |
| `--ink-2` | 8.33 | 6.70 | 5.56 | 3.67 (not allowed) | 5.93 / 6.95 |
| `--ink-3` | 5.75 | 4.63 | 3.84 | — | — |
| `--signal-ink` | 6.95 | 5.59 | 4.64 | — | — |
| `--signal` (dot) | 4.19 | 3.37 | 2.80 (not allowed) | — | — |
| `--ok` | 6.49 | 5.22 | 4.33 (not allowed) | — | — |
| `--warn` | 7.13 | 5.73 | 4.76 | — | — |
| `--critical` | 7.09 | 5.71 | 4.73 | — | — |

On their own soft fills: `--ok` 5.30, `--warn` 5.77, `--critical` 5.47. White on `--primary`: 18.52.

**Dawn, dark:**

| Text | sheet | card | nested | lift | slate | dawn (top / bottom) |
|---|---|---|---|---|---|---|
| `--foreground` | 16.24 | 14.21 | 11.98 | 9.57 | 7.60 | 12.87 / 11.12 |
| `--ink-2` | 9.52 | 8.33 | 7.02 | 5.61 | 4.46 (not allowed) | 7.55 / 6.52 |
| `--ink-3` | 6.02 | 5.27 | 4.44 | 3.55 | — | — |
| `--signal-ink` | 8.68 | 7.59 | 6.40 | 5.12 | — | — |
| `--signal` (dot) | 6.08 | 5.32 | 4.48 | 3.58 | — | — |
| `--ok` | 9.38 | 8.20 | 6.91 | 5.53 | — | — |
| `--warn` | 9.86 | 8.63 | 7.27 | 5.81 | — | — |
| `--critical` | 7.76 | 6.79 | 5.72 | 4.57 | — | — |

On their own soft fills: `--ok` 6.50, `--warn` 7.08, `--critical` 6.04. Navy on `--primary`: 16.24.
