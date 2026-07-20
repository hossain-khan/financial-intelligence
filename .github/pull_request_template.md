## Problem and outcome

<!-- What user/developer problem does this solve, and what behavior results? -->

## Scope and design

<!-- Describe the implementation boundaries, important choices, and linked issue/acceptance criteria. -->

## Mandatory documentation impact audit

List the files changed for every applicable category. When a category is unchanged, name the files
reviewed and explain concretely why their existing content remains accurate. Do not use a bare
"N/A" and do not defer documentation to a later agent or epic cleanup PR.

- [ ] Numbered product/feature specification:
- [ ] Architecture and data model:
- [ ] Security and privacy:
- [ ] Portable schemas, generated types, examples, and compatibility/version notes:
- [ ] ADR and ADR index, or explanation that this follows an existing decision:
- [ ] README and `CHANGELOG.md`:
- [ ] Roadmap and GitHub issue/milestone state:
- [ ] Developer/agent guidance:

## Data, compatibility, and migration

<!-- Describe canonical/persisted data changes, migration/rollback behavior, and backward compatibility. -->

## Privacy, security, and network impact

<!-- State data exposure and network changes explicitly, including "none" with the reviewed boundaries. -->

## Accessibility and UI evidence

<!--
Every PR must complete this section. If no visible UI changes, identify the reviewed presentation
boundary and explain concretely why screenshots and visual validation do not apply.

For visible UI changes, read docs/13-UX-GUIDELINES.md and docs/21-DESIGN-SYSTEM.md, then complete
every applicable item below. Do not approve a visual change from screenshots alone.
-->

- [ ] UI impact classified as visible UI change or no visible UI change, with a concrete reason.
- [ ] Existing shell, component, token, state, and responsive patterns were reused before adding a
      variant; new patterns or tokens are documented in `docs/21-DESIGN-SYSTEM.md`.
- [ ] No page-specific theme, unsupported utility-CSS dialect, arbitrary literal color, or
      unexplained inline style was introduced.
- [ ] Loading, empty, partial, error, disabled, offline, unavailable, permission-denied, and stale
      states were implemented or assessed as applicable.
- [ ] Keyboard operation, visible focus, screen-reader names/status announcements, 320 CSS pixel
      reflow, 200% zoom, reduced motion, and forced colors were validated as applicable.
- [ ] Before/after screenshots for changed surfaces, or expanded/compact screenshots for new
      surfaces, are included without exposing real financial or personal data.

<!-- Describe the evidence, link screenshots, and explain any item that does not apply. -->

## Verification

<!-- List the exact commands/tests run and their results. -->

## Known limitations and follow-ups

<!-- Link follow-up issues with dependencies/sequence. Do not use follow-ups for required in-scope docs or tests. -->
