import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

/**
 * Admin route group layout — gates everything under /admin on an authed user.
 * Unauthed requests get bounced to /login (which starts Google OAuth).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  // The root body is overflow-hidden (required by the TV watch page), so we
  // build our own scroll container here: fixed header up top, main area is
  // a flex-1 overflow-y-auto region that actually scrolls.
  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-semibold text-white hover:text-white/90"
            >
              Frogo Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-400">
              <Link href="/admin" className="hover:text-white">
                Channels
              </Link>
              <Link href="/" className="hover:text-white">
                View site
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <span className="truncate max-w-[200px]">{user.email}</span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="px-3 py-1 rounded border border-neutral-700 hover:border-neutral-500 hover:text-white transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
