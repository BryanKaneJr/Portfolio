/**
 * An invite opened while signed out (owner, 2026-10-01: invite links must
 * work for people who don't have an account yet). The sign-in gate keeps the
 * code here, and once they're in, it opens the invite instead of Home. Memory
 * only: an invite is a moment, and nothing about it is stored on the device.
 */
let pending: string | null = null;

/** Remembers the code from a path like /invite/AB12CD34. */
export function holdInviteFrom(path: string): void {
  const m = /^\/invite\/([A-Za-z0-9]{8})$/.exec(path);
  if (m) pending = m[1]!.toUpperCase();
}

/** The held code, once (it's cleared as it's read). */
export function takePendingInvite(): string | null {
  const code = pending;
  pending = null;
  return code;
}
