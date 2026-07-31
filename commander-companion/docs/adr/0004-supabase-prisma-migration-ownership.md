# ADR-0004: Supabase + Prisma migration ownership

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Lead engineer

## Context

Both Supabase (via its own migration tooling and dashboard) and Prisma can own schema DDL.
Having two owners causes drift. Supabase additionally provides Auth, storage, and RLS, which
Prisma does not model.

## Decision

**Prisma owns table/column DDL.** **Supabase provides** Postgres hosting, Auth, and storage.
**Extensions and Row-Level Security are managed by hand-written SQL migrations** committed
alongside Prisma migrations (Prisma cannot express RLS). RLS policies bind `owner_id =
auth.uid()` and act as defense in depth behind application-level authorization.

## Consequences

- One schema source of truth (Prisma) plus explicit SQL for RLS/extensions.
- Auth provider fields in the schema stay minimal until the Supabase Auth wiring lands
  (CC-AUTH-003); RLS is enabled at that point.
- Team must avoid editing schema via the Supabase dashboard (drift). Documented in DATABASE.md.

## Alternatives considered

- **Supabase-owned migrations:** better RLS ergonomics, but STEP 2 centers Prisma and it would
  split schema ownership.
- **Self-hosted Postgres + custom auth:** more control, more undifferentiated work; revisit only
  if Supabase constraints bite.
