# Agent Issue Tracker — UI/UX rationale

This document explains design choices for the static front-end prototype (`index.html`, `styles.css`, `app.js`) and lists product areas that will need further UI/UX decisions as the system grows.

## Hosting and architecture

The UI is **fully static**: HTML, CSS, and vanilla JavaScript only. Data persists in **`localStorage`**, so the prototype deploys cleanly to **GitHub Pages** or **Cloudflare Pages** with no server runtime. Export/import JSON supports backups and a future path where agents consume issues from a file or API. This keeps friction low for fast iteration while staying within the “static hosting only” constraint.

## Visual hierarchy

1. **Header band** — Largest type (`brand__title`), high-contrast gradient using the primary blue. This anchors the product identity and separates navigation/actions from workspace content.
2. **Sidebar panels** — Uppercase, small section titles (`panel__title`) establish filters and budget as *secondary* to the issue list but still scannable.
3. **Main list** — Issue **titles** are the dominant element per card (600 weight, ~1.125rem). Status, priority, and audience appear as **badges** in a predictable row so the eye can scan columns of meaning without reading body text.
4. **Descriptions** — Muted color and line clamp (three lines) keep cards scannable; detail lives behind “edit” via the title control (button styled as a link for affordance).
5. **Footer meta** — Monospace figures for tokens, minutes, and dates signal *measurement* and align with budgeting mental models.

## Color psychology mapping

| Role | Palette choice | Rationale |
|------|----------------|-----------|
| Primary / header | Deep blue | Associated with trust, focus, and productivity; suitable for a tool people open often without feeling “alarm fatigue.” |
| Success / done | Muted green | Reinforces completion without neon “gaming” vibes; paired with a soft green tint in dark mode. |
| In progress | Amber | Draws attention to active work; warmer than blue, less anxious than red. |
| Blocked / critical | Coral / red | Reserved for states that need interruption; used sparingly on badges and destructive actions. |
| Agent audience | Violet tint | Distinguishes “agent” workflows from neutral “human” without implying error (unlike red). |
| Surfaces | Off-white / cool neutrals (light), deep blue-grays (dark) | Reduces glare; `prefers-color-scheme: dark` respects system preference for long sessions. |

Color is **never the only signal**: badges include text labels; priority uses both hue and explicit **P0–P3** labels.

## Accessibility and clarity

- **Skip link** to `#main` for keyboard and screen-reader users.
- **Landmarks**: `header`, `aside`, `main`, labeled regions for filters, list, and dialogs.
- **Focus visibility**: 3px focus rings on interactive elements; modal traps attention with `role="dialog"` and `aria-modal="true"`.
- **Live region** for result counts (`aria-live="polite"`) and toasts (`assertive`) for import/export and save feedback.
- **Form labels** visible on every control; budget meter exposes **`aria-valuenow`** for approximate percentage.
- **`prefers-reduced-motion`**: disables smooth scroll and collapses transitions to near-zero duration.

## Interaction patterns

- **Filter chips** (toggle) vs. **sort** (single select): multi-select filters match how people combine “status + audience”; sort stays exclusive to avoid contradictory ordering.
- **Modal for create/edit** keeps context (filters remain visible in the backdrop) while focusing on one record — a compromise between speed and clarity; a full-page editor might scale better for very long agent-generated specs.
- **Comfortable / compact density** remembers preference in `localStorage` for power users scanning many issues.
- **Delete** uses a native `confirm()` in the prototype; a production app should replace this with an accessible confirmation dialog and undo.

## Features implemented in the prototype

- CRUD issues (title, description, status, priority, audience, estimated tokens, time budget, labels).
- Search across title, description, and labels.
- Multi-filter: status, priority, audience.
- Sort: recently updated, priority, newest, token estimate.
- Soft **token budget meter** (open issues only; excludes `done` from the sum).
- JSON **export** and **import** (array of issues or `{ "issues": [...] }`).

---

## Features that will require further UI/UX decisions

These are natural extensions of an “agent-aware” issue tracker; each implies tradeoffs among simplicity, automation, and governance.

1. **Human vs. agent “views”** — Separate layouts (dense JSON panel vs. narrative view), role-based defaults, or a single adaptive UI with toggles.
2. **Token and cost models** — Actual spend vs. estimates, per-model pricing, rolling windows, team vs. personal budgets, and warnings before work starts.
3. **Time tracking** — Estimates vs. timers vs. calendar integration; how much to show in-list vs. in analytics.
4. **Collaboration** — Assignees, mentions, comments, reactions, and notification channels (too much UI can defeat “AI-speed” planning).
5. **Workflows** — Custom statuses, WIP limits, automations (e.g. auto-move when PR opens), and how agents trigger transitions safely.
6. **Integrations** — GitHub Issues, Linear, JIRA, CI, and LLM providers: mapping fields, sync direction, conflict resolution, and surfacing integration errors.
7. **Versioning and audit** — Issue history, who/what changed a field, and agent attribution for accountability.
8. **Permissions and visibility** — Public vs. team vs. agent-only fields; PII and secret handling in descriptions.
9. **Bulk operations** — Multi-select, batch edit, and agent-generated patch application with human review.
10. **Reporting** — Burn-down, throughput, and cost dashboards: how little can we show while still steering the team?
11. **Offline and sync** — Beyond localStorage: conflict UI when two sources update the same issue.
12. **Internationalization** — RTL layouts, locale dates, and translated status semantics.

---

## File map

| File | Purpose |
|------|---------|
| `index.html` | Structure, semantics, modal shell |
| `styles.css` | Tokens, themes, components, responsive layout |
| `app.js` | State, CRUD, filters, persistence, import/export |
| `UI_UX.md` | This document |

To try locally, open `index.html` in a browser or serve the folder with any static file server.
