import Link from "next/link";

const team = [
  {
    name: "Alex Miller",
    role: "Founder & CEO",
    linkedin: "https://www.linkedin.com/in/aimiller/",
  },
  {
    name: "Alexey Kamenskiy",
    role: "CTO",
    linkedin: "https://www.linkedin.com/in/akamenskiy/",
  },
  {
    name: "Farhad Gayur",
    role: "Design",
    linkedin: "https://www.linkedin.com/in/farhadg/",
  },
  {
    name: "Matthew Rauciet",
    role: "Core Team",
    linkedin: null,
  },
  {
    name: "BYVoid",
    role: "Core Team",
    linkedin: "https://www.linkedin.com/in/byvoid/",
  },
  {
    name: "Carbo Claw",
    role: "Core Team",
    linkedin: null,
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors mb-8 inline-block"
      >
        &larr; Back
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">About Frogo.tv</h1>
      <p className="text-muted mb-8 max-w-lg">
        Frogo.tv started in 2012 as a social video watching platform — watch
        YouTube together with friends, synced across devices. This is the 2026
        reboot, built with modern tech but the same spirit.
      </p>

      <h2 className="text-xl font-semibold mb-4">Original Team</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {team.map((member) => (
          <div
            key={member.name}
            className="rounded-xl border border-card-border bg-card-bg p-4"
          >
            <div className="font-medium">{member.name}</div>
            <div className="text-sm text-muted">{member.role}</div>
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline mt-1 inline-block"
              >
                LinkedIn
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-card-border text-sm text-muted">
        <p>
          Originally built 2012-2014 with Node.js, Express, Socket.io, MongoDB,
          Redis, and MySQL. Rebooted in 2026 with Next.js, Supabase, and Vercel.
        </p>
        <p className="mt-2">
          <a
            href="https://github.com/fotoflo/frogo2026"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            View source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
