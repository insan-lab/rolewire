import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs text-zinc-400">404</p>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900">That page does not exist</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The link may be out of date, or the job or application it pointed to was removed.
      </p>
      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/dashboard" className="font-medium text-accent-700 hover:underline">
          Go to dashboard
        </Link>
        <Link href="/" className="text-zinc-600 hover:underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
