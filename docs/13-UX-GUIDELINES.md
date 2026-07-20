# UX Guidelines

## Purpose

Define experience principles, information architecture, interaction patterns, content standards, responsive behavior, and accessibility requirements.

## Experience goals

The product should feel calm, trustworthy, and inspectable. It must help a first-time user reach insight without concealing consequential decisions, and help a returning user review hundreds of records efficiently.

## Information architecture

Primary destinations:

1. **Overview** — current cash flow, trends, attention items, backup status.
2. **Transactions** — canonical ledger, search, filters, bulk review.
3. **Review** — uncertain categories, merchants, duplicates, transfers, recurring series.
4. **Analysis** — cash flow, categories, merchants, recurring costs, savings, question interface.
5. **Imports** — add files, mapping sessions, history, errors, source provenance.
6. **Brain** — categories, merchants, rules, learning export/import, conflicts.
7. **Settings** — workspace, accessibility/display, AI providers, storage, backup, plugins, deletion.

On narrow screens, keep the same conceptual destinations with a bottom bar plus “More” or an accessible drawer. Do not hide critical privacy/backup state only in settings.

## First run

Use a short, skippable introduction:

- “Your statements stay on this device unless you enable a remote provider.”
- “Browser data can be cleared; create encrypted backups regularly.”
- Choose no AI (fully functional), local AI setup later, or advanced provider setup later.
- Add an account and import a statement.

Do not request notifications, persistent secrets, model downloads, or storage persistence before explaining the value.

## Import experience

Present import as a stepper with persistent progress:

1. Files and account
2. Format/mapping
3. Validation and duplicates
4. Summary and commit
5. Classification/review

Show inflows/outflows with words and signs/colors. Never rely on red/green alone. Ambiguous date/amount formats require confirmation. Errors are attached to rows and summarized; users can export them. If source retention is offered, explain why and storage impact.

## Transaction review

- Provide dense and comfortable display modes without sacrificing target sizes.
- Keep selection count and bulk action scope visible.
- Support keyboard next/previous, assign category, confirm, skip, and undo.
- Open a details panel with source value, provenance, classification method, evidence, rule, and history.
- Distinguish imported fact, inferred field, and user-confirmed field visually and in accessible text.
- A correction dialog defaults to “only this transaction”; reusable rules show examples before save.

## Dashboards

Every visualization has:

- a descriptive title and period;
- visible currency and filter summary;
- a one-sentence takeaway that avoids judgment;
- keyboard focus/selection behavior where interactive;
- non-color encodings, accessible table, and downloadable underlying rows;
- drill-down from mark/segment to transaction query.

Use a Sankey diagram only when flows are meaningful and legible; call it “Money flow” in product copy. On small screens, replace it with an ordered flow table or simplified stacked view. Never use a decorative chart when a number/table communicates better.

## Insights and language

Prefer evidence-led neutral copy:

- Good: “Restaurant spending was CAD 184 higher than the previous complete month, across 7 more transactions.”
- Avoid: “You wasted too much on restaurants.”
- Good: “This may be recurring every month. Last seen July 3.”
- Avoid: “Cancel this subscription now.”

Label incomplete periods, estimates, currency conversion, and uncertain classifications. Product content must not imply tax, legal, investment, or debt advice.

## Privacy and AI UI

Provider status is always visible where AI is invoked: local, self-hosted, remote, or off. Before remote use, show destination and data preview. Use separate actions for “Test connection” and “Analyze”; connection testing sends no transactions. Never preselect persistent key storage. Show model download size, memory estimate, progress, cancel, and remove controls.

## Destructive and high-impact actions

- Preview affected counts and dependencies.
- Use undo for ordinary edits and bulk changes.
- Require explicit confirmation for import deletion, restore replacement, rule effects over a high threshold, and workspace deletion.
- Confirmation copy names the object and consequence; avoid generic “Are you sure?”
- Do not use color as the sole warning cue.

## Accessibility

- Meet WCAG 2.2 AA for all core flows.
- Semantic landmarks/headings, labeled controls, predictable focus, and live-region progress announcements.
- Full keyboard support without requiring drag, hover, multi-pointer gestures, or timing.
- Visible focus with sufficient contrast; target sizes at least the applicable WCAG minimum and preferably larger.
- Reflow at 320 CSS px and 200% zoom; no essential two-dimensional scrolling except data tables/visualizations where unavoidable.
- Respect reduced motion, contrast preferences where possible, and user-selected density.
- Charts have summaries/tables; icons have labels where meaning is not redundant.
- Announce validation errors and associate them to fields/rows.

## Responsive strategy

| Width/context | Pattern |
| --- | --- |
| Compact | Single pane; detail as route/sheet; simplified charts; sticky primary action |
| Medium | Navigation rail; list + optional detail; two-column cards |
| Expanded | Persistent navigation; list-detail; configurable dashboard grid |

Breakpoints are chosen by content fit, not named devices. Support touch, mouse, trackpad, and keyboard. Horizontal tables use frozen identity columns and an accessible alternate card/details view.

## States

Every surface defines loading/progress, empty, partial, error, offline, capability-unavailable, permission-denied, and stale-data states. Skeletons do not hide long operations; show actual phase and cancellation. Empty states explain the next safe action and never fabricate sample financial data inside a real workspace.

## Formatting

- Store canonical values separately from display.
- Respect locale for dates, decimal/group separators, and currency placement.
- Always include currency when ambiguity exists.
- Use minus sign plus “outflow” semantics; allow accounting parentheses as a preference later.
- Avoid truncating merchant/description without an accessible full-value mechanism.

## Design-system requirements

Create tokens for color, type, space, elevation, motion, focus, chart palettes, and positive/negative/neutral semantics. Components must include form fields, data grid, filter bar, progress, inline validation, disclosure banner, confidence/evidence badge, chart shell, dialog, toast/live announcement, and command palette where useful.

The dashboard uses the same paper/cream/forest/mint/gold tokens, typography, controls, focus rings,
spacing, and responsive shell as the rest of the application. A shared filter bar covers account,
currency, merchant, tag, review state, recurring state, and date. Non-sensitive filter IDs/dates are
preserved in the dashboard URL; exact drilldown IDs travel in bounded navigation state. Charts use
the report's rows without recalculation and always retain an adjacent semantic table. Superseded
async results never replace a newer filter result.

## Usability validation

Test first import, ambiguous CSV mapping, overlapping re-import, category correction/rule preview, transfer pairing, dashboard drill-down, remote consent, Brain export, backup restore, and deletion with diverse users and assistive technology. Measure completion, errors, interpretation accuracy, time, and confidence—not just preference.

## Related documents

- [User stories](04-USER-STORIES.md)
- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
