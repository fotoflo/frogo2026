import Link from "next/link";
import { redirect } from "next/navigation";
import { createChannel } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase-server";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";

export const dynamic = "force-dynamic";

export default async function NewChannelPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const { parent } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/api/auth/signin?next=/admin/channels/new");

  const { data: ownedChannels } = await supabase
    .from("channels")
    .select("id, slug, parent_id")
    .eq("owner_id", user.id);

  const all = (ownedChannels ?? []) as ChannelLike[];
  const parentOptions = all
    .map((c) => ({
      id: c.id,
      label: buildChannelPath(c, all).join(" / "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-neutral-400 hover:text-white"
        >
          ← Back to channels
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New channel</h1>
      </div>

      <form action={createChannel} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            placeholder="Jazz Classics"
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Slug{" "}
            <span className="text-neutral-500 font-normal">
              (optional — defaults to name)
            </span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            placeholder="jazz-classics"
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="parent_id"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Parent channel{" "}
            <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <select
            id="parent_id"
            name="parent_id"
            defaultValue={parent ?? ""}
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none"
          >
            <option value="">(no parent — top-level channel)</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Nest this channel under another. Its URL becomes{" "}
            <code>/watch/parent/child</code>.
          </p>
        </div>

        <div>
          <label
            htmlFor="icon"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Icon{" "}
            <span className="text-neutral-500 font-normal">(emoji)</span>
          </label>
          <input
            id="icon"
            name="icon"
            type="text"
            defaultValue="📺"
            maxLength={4}
            className="w-20 px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none text-center text-xl"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="What plays on this channel?"
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 transition"
          >
            Create channel
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
