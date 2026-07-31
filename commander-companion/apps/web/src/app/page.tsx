/**
 * Placeholder landing page for the Phase 1 application shell. Replaced by the
 * real chat/search/deck surfaces in later phases (see docs/ROADMAP.md).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Commander Companion</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        An unofficial, citation-first Magic: The Gathering Commander rules and deck companion. Every
        rules answer is grounded in the current Comprehensive Rules, Oracle card text, official
        rulings, and Commander policy — with exact citations.
      </p>
      <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <strong>Unofficial Fan Content.</strong> Not affiliated with, endorsed, or sponsored by
        Wizards of the Coast. Not a substitute for an official judge or published policy.
      </p>
      <p className="text-sm text-neutral-500">
        Phase 1 foundation shell. See the roadmap for what ships next.
      </p>
    </main>
  );
}
