"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { dataSource, services } from "@/lib/services";
import type { AdminSession } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "./ui";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/units", label: "Units" },
  { href: "/admin/batch", label: "Batches" },
] as const;

/**
 * Signed-in admin console frame: header, navigation, and the session guard.
 * Children are shown only once a session is confirmed; otherwise we redirect to /admin.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let alive = true;
    void services.admin.getSession().then((s) => {
      if (!alive) return;
      if (s) setSession(s);
      else router.replace("/admin");
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const signOut = async () => {
    await services.admin.signOut();
    // Full load on purpose: clears every preserved (Activity) admin screen and its state, as
    // Next's "State and authentication" guidance recommends for sign-out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-(--z-header) border-b-2 border-admin-ink bg-admin-surface">
        <div className="mx-auto flex max-w-(--measure-admin) items-center gap-3 px-4 py-2.5 md:gap-8 md:px-8">
          <div className="flex items-baseline gap-2">
            <Logo href="/admin/dashboard" size="sm" />
            <span className="postal-label text-admin-ink-soft">Admin</span>
          </div>
          <Suspense fallback={<NavLinks active={null} className="hidden md:flex" />}>
            <ActiveNav className="hidden md:flex" />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <span className="hidden max-w-56 truncate text-sm text-admin-ink-soft lg:inline" title={session.email}>
                {session.email}
              </span>
            ) : (
              <Skeleton className="hidden h-4 w-40 lg:block" />
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={!session}
              className="min-h-11 rounded-soft px-3 text-sm text-admin-ink-soft hover:bg-admin-line/50 hover:text-admin-ink pointer-fine:md:min-h-9"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Phone: tabs under the header */}
        <Suspense fallback={<NavLinks active={null} className="flex border-t border-admin-line px-2 md:hidden" tabs />}>
          <ActiveNav className="flex border-t border-admin-line px-2 md:hidden" tabs />
        </Suspense>
      </header>

      <main id="main" className="mx-auto w-full max-w-(--measure-admin) flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* The page segment always renders (Next validates instant navigation per segment); it stays
            hidden behind a skeleton until the session is confirmed. Its service calls fail with
            `unauthorized` for signed-out visitors, so nothing is exposed meanwhile. */}
        <div hidden={!session}>{children}</div>
        {!session && <ConsoleSkeleton />}
      </main>

      <footer className="mx-auto w-full max-w-(--measure-admin) px-4 pb-6 text-xs text-admin-ink-soft md:px-8">
        {dataSource === "mock" ? "Saudade admin · simulated data in this prototype" : "Saudade admin"}
      </footer>
    </div>
  );
}

function ActiveNav({ className, tabs }: { className?: string; tabs?: boolean }) {
  const pathname = usePathname();
  const active = NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.href ?? null;
  return <NavLinks active={active} className={className} tabs={tabs} />;
}

function NavLinks({ active, className, tabs }: { active: string | null; className?: string; tabs?: boolean }) {
  return (
    <nav aria-label="Admin" className={cn("items-center gap-1", className)}>
      {NAV.map((n) => {
        const on = n.href === active;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 items-center justify-center px-3 text-sm transition-colors duration-(--motion-dur-fast)",
              tabs ? "flex-1" : "rounded-soft pointer-fine:md:min-h-9",
              on ? "font-semibold" : "text-admin-ink-soft hover:text-admin-ink",
              on && (tabs ? "text-admin-ink" : "bg-admin-ink text-paper-raised"),
              !tabs && !on && "hover:bg-admin-line/50",
            )}
          >
            {n.label}
            {tabs && on && <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 bg-admin-ink" />}
          </Link>
        );
      })}
    </nav>
  );
}

function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the admin" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
