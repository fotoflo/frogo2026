/**
 * Sign-in page. Just a "Continue with Google" button that points at the
 * existing /api/auth/signin initiator (which in turn calls
 * supabase.auth.signInWithOAuth and bounces to Google).
 *
 * We accept an optional ?next=/some/path search param and forward it so the
 * callback returns the user to where they came from.
 */
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/admin";
  const signinHref = `/api/auth/signin?next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Frogo</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Sign in to manage your channels
          </p>
        </div>

        <a
          href={signinHref}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition"
          aria-label="Continue with Google"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </a>

        <p className="text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-300">
            ← Back to Frogo
          </Link>
        </p>
      </div>
    </div>
  );
}
