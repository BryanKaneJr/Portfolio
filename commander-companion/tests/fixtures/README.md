# Test fixtures

Deterministic fixtures used across packages. Per the blueprint these must work
offline with **no** network or OpenAI dependency.

Planned fixture sets (populated as features land — see `docs/BACKLOG.md`):

- `card-layouts/` — one card per major layout: normal, split, modal DFC,
  transform DFC, adventure, meld, prototype (§3.3, §13.3).
- `decks/legal/` and `decks/illegal/` — Commander lists exercising deck/commander
  count, singleton, color identity, bans, partner pairings, and exception cards
  (§8.4).
- `rules/` — small excerpts of the Comprehensive Rules with known numbering for
  parser and retrieval tests (§13.3).
- `golden/` — curated rules questions with expected outcomes and controlling
  citations (§7.6). Target: ≥250 before public launch.

Fixtures are the source of truth for regression tests. When Commander policy
changes, add fixtures for both the old and new effective versions so historical
snapshots remain explainable (§8.4).
