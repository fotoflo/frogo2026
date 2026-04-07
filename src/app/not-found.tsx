import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-32 text-center">
      <div className="text-6xl mb-6">🐸</div>
      <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted mb-8">
        This channel doesn&apos;t exist yet. Maybe it&apos;s time to curate one?
      </p>
      <Link
        href="/"
        className="inline-block rounded-xl bg-accent hover:bg-accent-hover text-white font-medium px-8 py-3 transition-colors"
      >
        Browse Channels
      </Link>
    </div>
  );
}
