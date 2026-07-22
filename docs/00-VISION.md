# Vision

## Purpose

Define why Financial Intelligence exists, whom it serves, and the durable outcome the project pursues.

## Vision statement

Everyone should be able to understand their financial life without giving another company continuous access to it. Financial Intelligence turns files people already own—bank and card statements—into a private, understandable history of cash flow. It improves as the user teaches it, while keeping that learning inspectable and portable.

## The problem

Household finances are scattered across institutions and presented as rows of cryptic transaction descriptions. Existing products often reduce setup friction by asking for bank credentials or aggregating accounts in the cloud. That exchange is unacceptable or unavailable for many people. Spreadsheets preserve control but require repeated cleanup, categorization, formulas, and maintenance.

People need answers to ordinary questions:

- Where did our money go this month?
- Which costs are recurring, increasing, or no longer useful?
- How much did we save after transfers and credit-card payments were reconciled?
- Why was this transaction classified this way?
- Will the work I do correcting data still exist next year or on another device?

## Product thesis

A capable personal financial analyst can run primarily in the browser. Statement parsing, normalization, rules, visualization, and storage do not inherently require a server. Small local models can assist uncertain cases. As user-confirmed rules accumulate, deterministic classification should handle most repeat transactions. (Self-hosted or cloud models remain a possible long-term option for users who knowingly choose them, but are **deferred past 1.0**: 1.0 is browser-local AI only — see `docs/15-ROADMAP.md`.)

## Target users

### Primary: privacy-conscious household analyst

Imports statements periodically, wants reliable monthly insight, and does not want mandatory bank connections or an account.

### Secondary: spreadsheet graduate

Already exports CSV files but wants normalization, deduplication, repeatable rules, and better visualization without maintaining formulas.

### Secondary: technical power user

Wants portable formats, local models, custom endpoints, provider choice, plugins, and the ability to inspect or extend the system.

The first release is designed for individuals and households, not accountants, lenders, portfolio managers, or regulated financial institutions.

## Desired outcomes

- A first-time user can import a supported statement and see a trustworthy cash-flow view in minutes.
- A returning user spends less time correcting each import because learned rules apply predictably.
- Users can explain the source, transformation, category, and confidence of any transaction.
- A device migration does not require surrendering ownership or rebuilding learned behavior.
- The application remains useful when every AI feature is disabled.

## Principles that must survive implementation

1. **Local by default.** Core workflows work without transmitting financial data.
2. **User ownership.** Data and learning are exportable using documented, versioned formats.
3. **Review before authority.** Imports and low-confidence automation are previewed or surfaced for review.
4. **Rules before models.** Known facts are handled deterministically.
5. **Explain every inference.** A user can see why the application reached a conclusion.
6. **Corrections are valuable data.** Confirmed corrections may become reusable knowledge, with user control.
7. **No false precision.** The product communicates uncertainty and does not present advice as guaranteed outcomes.
8. **Inclusive by construction.** Accessibility and international financial formats are architectural concerns.

## Non-goals

- Storing bank credentials or screen-scraping online banking.
- Initiating payments, transfers, trades, or credit applications.
- Providing tax, legal, investment, or debt advice.
- Predicting markets or guaranteeing savings outcomes.
- Replacing an institution's official records.
- Requiring a hosted backend for the core product.
- Perfect extraction from every image-only or adversarial PDF in the initial release.

## Success in three years

The project supports a broad, community-maintained set of import adapters; most returning-user transactions classify without model use; portable Financial Brain files interoperate across releases; local analysis feels immediate on ordinary hardware; and contributors can add guarded capabilities without weakening the core privacy boundary.

## Risks to the vision

- Browser storage can be cleared unexpectedly; backup education must be prominent.
- Financial statement formats vary widely and change without notice.
- Local model availability differs across devices and browsers.
- A plugin or remote provider could undermine privacy if permissions are vague.
- Automated insights can sound like advice; language and evidence must remain disciplined.

## Related documents

- [Design principles](01-DESIGN-PRINCIPLES.md)
- [Product requirements](03-PRODUCT-REQUIREMENTS.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [Roadmap](15-ROADMAP.md)
