import Link from "next/link";

export default function PreviewIndexPage() {
  const links = [
    { href: "/preview/dm-thread", label: "DM thread" },
    { href: "/preview/dm-call", label: "DM active call" },
    { href: "/preview/hubs", label: "Hubs" },
    { href: "/preview/settings", label: "Settings" },
    { href: "/preview/admin", label: "Admin" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-5xl flex-col justify-center gap-4 px-6">
      <p className="section-kicker">Preview surfaces</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Built proof routes
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-[var(--text-dim)]">
        These routes exist only to capture the redesigned production components after a
        successful build, without depending on live auth or realtime state.
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="eyebrow-pill">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
