# Design System

## Purpose

Define the visual language and reusable interface rules for Financial Intelligence so that human
contributors and AI coding agents can extend the product without creating visually inconsistent
pages. This guide is normative for product UI. The implemented source of truth for tokens and
component styles is [`apps/web/src/styles.css`](../apps/web/src/styles.css).

## Scope

This guide covers product character, color, typography, spacing, shape, elevation, layout,
components, charts, content, responsive behavior, accessibility, and UI-change validation. It
applies to every application surface, including loading, empty, error, offline, dialog, and review
states.

## Design goals

The interface should feel:

- **calm** — quiet surfaces and restrained emphasis support deliberate financial review;
- **trustworthy** — exact values, provenance, status, and consequences remain visible;
- **inspectable** — summaries lead to the records and evidence that produced them;
- **warm, not playful** — cream paper, deep forest, mint, and gold distinguish the product without
  making financial outcomes celebratory or judgmental;
- **efficient** — information-dense workflows remain scannable and keyboard accessible;
- **inclusive** — visual polish never replaces semantic structure or accessible alternatives.

## Non-goals

- Do not imitate a bank portal, trading terminal, or generic admin dashboard.
- Do not use decorative charts, gamified rewards, alarming red/green scorekeeping, or judgmental
  financial language.
- Do not create a second page-specific theme, token set, component library, or utility-CSS dialect.
- Do not sacrifice exact values, labels, focus visibility, or target size to achieve a minimal look.

## Source-of-truth order

When sources appear to disagree, use this order and reconcile the lower source in the same PR:

1. Accessibility, privacy, and product requirements.
2. This design-system guide and [`13-UX-GUIDELINES.md`](13-UX-GUIDELINES.md).
3. Tokens and shared component rules in `apps/web/src/styles.css`.
4. Existing production components that already follow the first three sources.
5. Issue mockups or screenshots.

A screenshot is reference material, not authority to copy inaccessible or inconsistent behavior.

## Visual language

### Brand icon

The canonical application icon is the pie-chart dollar artwork in
`apps/web/public/favicon.svg`. Use the complete mark for browser and installed-application identity;
do not recolor, redraw, crop, rotate, or place interface status badges over it. Platform-specific
maskable output adds only the safe-zone padding needed to prevent clipping. The icon is brand
identity, not an unlabeled substitute for transaction, chart, or money actions inside the product.

### Color

Use semantic custom properties rather than literal colors in components.

| Token | Current value | Intended use |
| --- | --- | --- |
| `--ink` | `#162521` | Primary text and high-contrast marks |
| `--ink-muted` | `#52645f` | Secondary text and supporting metadata |
| `--forest` | `#0d3b35` | Brand surface, primary action, strong emphasis |
| `--forest-soft` | `#dce8df` | Quiet selected or supporting surface |
| `--mint` | `#9ad7b3` | Brand accent and contrast on forest surfaces |
| `--cream` | `#f3f1e8` | Application canvas |
| `--paper` | `#fcfbf6` | Cards, panels, and raised working surfaces |
| `--gold` | `#d39b45` | Sparse attention or provenance accent |
| `--line` | `#ccd5ce` | Borders, separators, and control outlines |
| `--danger` | `#9d2d2d` | Destructive actions and errors with text/icon cues |
| `--focus` | `#116c5e` | Visible keyboard focus and active control outline |

Rules:

- Use `--cream` for the canvas and `--paper` for content surfaces. Do not make every section a dark
  card.
- Reserve `--forest` for brand anchors and primary emphasis; reserve mint and gold for accents.
- Do not introduce a literal color when an existing semantic token expresses the purpose. If no
  token fits, add a named semantic token centrally and document its contrast and use.
- Opacity variants and gradients must derive from the palette and retain readable contrast.
- Positive, negative, warning, review, and neutral states need a word or icon in addition to color.
- Never encode income/outflow, confidence, or financial health using color alone.

### Typography

- Body, controls, tables, and metadata use `Inter`, followed by the system sans-serif stack.
- Display headings use `Georgia`, followed by `Times New Roman`, to create the editorial character.
- Use the display face for page titles, section titles, and intentional card headlines—not for form
  labels, table content, dense review controls, or paragraphs.
- Use fluid `clamp()` sizing for page-level headings and stable rem sizes for controls and data.
- Keep body text readable at browser defaults. Supporting text may be smaller but must not become
  the only place where consequential information appears.
- Use tabular numerals for aligned monetary and date columns when the selected font supports them.
- Avoid all-caps body copy. Eyebrows may use uppercase with restrained letter spacing.

### Spacing and density

The existing interface is based on a 0.25rem rhythm. Prefer these steps when adding or consolidating
styles: `0.25`, `0.5`, `0.75`, `1`, `1.5`, `2`, `3`, and `4rem`. Use `clamp()` where page padding
must scale with available width.

- Keep related label/control/help content within `0.25–0.5rem`.
- Use `0.75–1rem` between controls in a group.
- Use `1–1.5rem` within cards and `1.5–2rem` between page sections.
- Dense transaction views may reduce whitespace, but interactive targets must retain accessible
  size and visible separation.
- Do not invent arbitrary one-off spacing when an existing rhythm step works.

### Shape and elevation

- `--radius-md` (`16px`) is the default for controls, notices, and nested cards.
- `--radius-lg` (`28px`) is reserved for page-level panels, heroes, and major surfaces.
- Use smaller pill radii only for compact statuses and chips.
- `--shadow` is the standard raised-panel shadow. Prefer borders and surface contrast for nested
  hierarchy; stacking multiple heavy shadows makes the interface noisy.

### Motion

- Motion explains state change; it is not decoration.
- Prefer short color, border, and opacity transitions. Avoid parallax, bouncing, and continuous
  animation.
- Respect `prefers-reduced-motion: reduce`; no workflow may depend on animation.
- Loading operations expose a named phase, progress where measurable, and cancellation where safe.

## Page composition

Use the existing application shell, skip link, header, navigation, and `.main-content` container.
New pages should use these patterns:

1. An eyebrow and one clear page heading.
2. A concise explanation of purpose, privacy, or current scope when useful.
3. Primary actions close to the heading or the object they affect.
4. Paper panels grouped by user task, not implementation subsystem.
5. Status and errors next to the relevant action, announced through appropriate live regions.

Use the established `.hero`, `.section-heading`, `.import-panel`, `.dashboard-panel`, `.metric-grid`,
`.metric-card`, `.preview-actions`, `.secondary-button`, `.storage-chip`, and table-shell patterns
before adding variants. A new reusable pattern belongs in the shared component layer of
`styles.css`, not in inline styles or a page-specific collection of utility-looking class names.

## Component rules

### Buttons and links

- Use the shared native `Button` for ordinary actions. It preserves native keyboard/click semantics,
  the existing `data-disabled` styling contract, and strict-CSP compatibility without runtime inline
  style mutation. React Aria button/press primitives are not used unless their production bundle is
  proven to operate without inline style writes.
- One primary action per local decision area. Secondary and text actions remain visually quieter.
- Button labels state the result: “Apply import,” “Confirm transfer,” or “Export CSV.” Avoid “OK,”
  “Submit,” and icon-only consequential actions.
- Destructive actions use the danger treatment and explicit consequence copy.
- Disabled controls must remain perceivable; explain the unmet prerequisite near the control.
- Links navigate. Buttons change state or start work.

### Forms and filters

- Every control has a persistent visible label; placeholders are examples, not labels.
- Help and validation text are associated programmatically with the control.
- Use the shared field, input, select, and filter-bar treatments. Do not restyle native behavior on
  one page without updating the shared pattern.
- Preserve non-sensitive dashboard filters in the URL as specified by the UX guide.
- Error summaries link or move focus to the affected control when multiple fields fail.

### Cards, panels, chips, and status

- A card groups one concept or action. Avoid a card for every individual sentence or metric.
- Chips represent compact metadata or status, not primary actions.
- Status uses neutral, proposed, confirmed, dismissed/muted, warning, and error semantics consistently.
- Loading, empty, partial, error, offline, unavailable, and stale states are designed states—not
  blank panels.

### Tables and transaction lists

- Use semantic tables for genuinely tabular data, with captions and scoped headers.
- Align money consistently and always display currency when ambiguity is possible.
- Preserve full values through wrapping, details, or an accessible title/description mechanism.
- Allow horizontal scrolling only inside the data region; the whole page must still reflow at 320
  CSS pixels.
- Dense and comfortable modes share semantics, keyboard behavior, and minimum target size.

### Dialogs and high-impact actions

- Use an accessible dialog primitive with an initial focus target, focus containment, Escape
  behavior where safe, and focus restoration.
- Name the affected object, affected count, and consequence.
- Prefer undo for ordinary corrections. Require confirmation for destructive or broad changes.

## Data visualization

- Derive charts from the same report rows rendered by the adjacent table; do not recalculate values
  in the component.
- Every chart includes a descriptive title, period, currency, active-filter summary, neutral
  takeaway, semantic table, and exact drill-down path.
- Color is supplemental. Use labels, position, pattern, sign, or shape to preserve meaning.
- Use the forest/mint/gold family plus accessible semantic state colors. Add any larger chart palette
  as centralized tokens and verify contrast between adjacent series.
- Prefer a number or table when it communicates more clearly than a chart.
- Replace complex flow graphics with an ordered table or simplified view on compact layouts.

## Responsive behavior

Choose breakpoints based on content fit. The current implementation commonly transitions near
`40rem`, `44rem`, and `64rem`; reuse an existing breakpoint when it matches the content failure.

| Context | Expected composition |
| --- | --- |
| Compact | One column; wrapping actions; detail as route/sheet; simplified chart plus table |
| Medium | Two-column cards where content remains readable; optional list/detail split |
| Expanded | Persistent navigation; wider list/detail and dashboard grids |

All core workflows must work at 320 CSS pixels, 200% zoom, with touch, mouse, and keyboard. Do not
hide essential actions solely because the viewport is compact.

## Content language

- Be factual, neutral, and concise: “Restaurant spending increased by CAD 184,” not “You overspent.”
- Distinguish imported facts, inferred values, and user-confirmed decisions.
- Label estimates, incomplete periods, uncertainty, and exchange-rate assumptions.
- Explain privacy and network boundaries at the point of action.
- Do not imply tax, legal, investment, debt, or moral advice.

## Accessibility requirements

WCAG 2.2 AA is the minimum target. Every new or changed surface must provide:

- semantic landmarks and a logical heading structure;
- complete keyboard operation and visible `--focus` treatment;
- labeled controls, associated errors, and predictable focus movement;
- live announcements for asynchronous status without excessive repetition;
- non-color meaning and text alternatives for icons and visualizations;
- reduced-motion and forced-colors behavior;
- usable reflow at 320 CSS pixels and 200% zoom;
- target sizes meeting the applicable WCAG minimum, preferably larger.

React Aria Components are preferred for interaction primitives when compatible with the production
CSP. The shared native `Button` is the ordinary-action exception documented above. An unstyled
primitive supplies behavior, not permission to invent a new visual treatment.

## Agent implementation workflow

Before changing UI, an AI coding agent must:

1. Read this guide, `13-UX-GUIDELINES.md`, and the relevant existing page and shared styles.
2. Inventory the closest existing shell, component, token, state, and responsive pattern.
3. State which patterns will be reused and justify every new variant or token.
4. Implement semantics and interaction states together with visual styling.
5. Remove placeholder utility classes or inline styles that are not supported by the project
   styling architecture.
6. Test loading, empty, success, error, disabled, narrow, keyboard, reduced-motion, and
   forced-colors behavior in proportion to the change.
7. Include before/after screenshots for visible changes at an expanded and a compact viewport.
8. Update this guide when a reusable visual rule or component contract changes.

### Reuse-before-invention rule

Do not create a new component appearance until the agent has searched the application for an
existing equivalent. If a new pattern is necessary, make it reusable, use tokens, document its
states here, and apply it consistently in the same scope. Do not copy a block of styles and rename
its selectors.

## Review checklist

- [ ] The page uses the shared shell, palette, type, spacing, radii, elevation, and focus treatment.
- [ ] No unsupported utility classes, arbitrary literal colors, or unexplained inline styles were added.
- [ ] Existing shared components and selectors were reused before introducing variants.
- [ ] Loading, empty, partial, error, offline, unavailable, and stale states are handled as applicable.
- [ ] Keyboard, screen-reader, 320px reflow, 200% zoom, reduced-motion, and forced-colors behavior
      were checked.
- [ ] Charts have summaries, semantic tables, non-color meaning, and exact drill-down.
- [ ] Expanded and compact screenshots accompany visible UI changes.
- [ ] Relevant component tests, Playwright flows, and CI-equivalent checks pass.
- [ ] This guide and UX requirements remain synchronized with implementation.

## Open questions

- When should current spacing and typography values be promoted into complete named token scales?
- Should a lightweight component-catalog route be added for development and accessibility review?
- Which screenshot-diff tool best fits the repository without producing brittle platform-specific
  baselines?

These questions do not permit local one-off design systems. Until resolved, follow the documented
palette, rhythm, shared selectors, and review workflow.

## Related documents

- [UX guidelines](13-UX-GUIDELINES.md)
- [Technology stack](16-TECHNOLOGY-STACK.md)
- [Quality baseline](17-QUALITY-BASELINE.md)
- [Cash-flow and filtered export](18-CASH-FLOW-AND-FILTERED-EXPORT.md)
- [Phase 2 implementation](20-PHASE-2-IMPLEMENTATION.md)
- [ADR-004: Technology stack](adr/ADR-004-Technology-Stack.md)
