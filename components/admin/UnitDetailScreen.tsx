"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useNow } from "@/components/public/useNow";
import { PLACEHOLDER_CHIP_DOMAIN, recipientUrl, site } from "@/config/site";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import type { DeliveryPath, RevealEvent, UnitDetail } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { cn } from "@/lib/utils/cn";
import { dateTime } from "@/lib/utils/format";
import { AuditList } from "./AuditList";
import { ContentHistory } from "./ContentHistory";
import { loadErrorText, useUnauthorizedRedirect } from "./DashboardScreen";
import { EmptyState } from "./EmptyState";
import { StatusChip } from "./StatusChip";
import { UnitActions } from "./UnitActions";
import { UnitContent } from "./UnitContent";
import { UnitTimeline } from "./UnitTimeline";
import { AdminLinkButton, Card, CopyButton, Field, LoadError, Skeleton } from "./ui";

/** S23: one unit. Reads [id] with useParams, so the page renders it inside Suspense. */
export function UnitDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const q = useServiceQuery(() => services.admin.getUnit(id), [id]);
  useUnauthorizedRedirect(q.error);

  return (
    <>
      <Link href="/admin/units" className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-soft text-sm text-admin-ink-soft hover:text-admin-ink pointer-fine:md:min-h-8">
        <span aria-hidden>←</span> All units
      </Link>
      {/* Also a skeleton while a preserved screen switches to another unit's id. */}
      {(q.status === "loading" || (q.status === "success" && q.data.unit.id !== id)) && <DetailSkeleton />}
      {q.status === "error" &&
        (q.error.code === "not_found" ? (
          <Card>
            <EmptyState
              title="We couldn't find that unit"
              body="It may have been mistyped in the address. Search for it by code or email instead."
              action={<AdminLinkButton href="/admin/units">Go to all units</AdminLinkButton>}
            />
          </Card>
        ) : q.error.code !== "unauthorized" ? (
          <LoadError message={loadErrorText(q.error)} onRetry={() => q.reload()} />
        ) : null)}
      {/* Keyed by unit: Activity keeps this route mounted, so form drafts must not leak between units. */}
      {q.status === "success" && q.data.unit.id === id && <DetailBody key={q.data.unit.id} detail={q.data} onChanged={() => q.reload(true)} />}
    </>
  );
}

function DetailBody({ detail, onChanged }: { detail: UnitDetail; onChanged: () => void }) {
  const { unit, contents, audit, reveals, history } = detail;
  const now = useNow();
  const url = recipientUrl(unit.slug);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="postal-label mb-1 text-admin-ink-soft">Unit{unit.unitNo ? ` ${unit.unitNo}` : ""}</p>
          <h1 className="flex flex-wrap items-center gap-3">
            <span className="font-postal text-3xl tracking-[0.08em] text-admin-ink">{unit.code}</span>
            <StatusChip status={unit.status} showProposed />
          </h1>
        </div>
        {/* Production returns codes masked (SAUD-····) outside generation/reset: nothing to copy then. */}
        {!unit.code.includes("·") && <CopyButton text={unit.code} label="Copy code" />}
      </div>

      <Card title="Details" className="mb-6" bodyClassName="px-4 py-2 md:px-5">
        <dl className="grid divide-y divide-admin-line/70 md:grid-cols-2 md:gap-x-8 md:divide-y-0">
          <Field label="Recipient link">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs break-all text-admin-ink">{url}</span>
              <CopyButton text={url} label="Copy link" />
            </span>
            <span className="mt-1 block text-xs text-admin-ink-soft">
              Encoded on the ceramic&apos;s NFC chip.
              {site.chipDomain === PLACEHOLDER_CHIP_DOMAIN && " Domain is a placeholder until it's confirmed (O2)."} Opening it in this browser while
              signed in (a packing check) never uses up the recipient&apos;s first open.
            </span>
          </Field>
          <Field label="Delivery path">
            <PathControl unitId={unit.id} path={unit.path} onChanged={onChanged} />
          </Field>
          <Field label="Sender email">{unit.senderEmail ?? <span className="text-admin-ink-soft">Not given</span>}</Field>
          <Field label="Sender link">
            {unit.senderToken ? "Active (private link, never shown here)" : <span className="text-admin-ink-soft">None: not claimed yet, or the code was reset</span>}
          </Field>
          <Field label="NFC slug">
            <span className="font-mono text-xs">{unit.slug}</span>
          </Field>
          <Field label="Last updated">{dateTime(unit.updatedAt)}</Field>
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          <UnitActions unit={unit} lastCodeResetAt={audit.find((a) => a.action === "unit.code_reset")?.at ?? null} onChanged={onChanged} />
          <UnitTimeline unit={unit} />
        </div>
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <UnitContent unitId={unit.id} code={unit.code} contents={contents} now={now} onChanged={onChanged} />
          <ContentHistory unitId={unit.id} history={history ?? []} onChanged={onChanged} />
          <RevealEvents reveals={reveals} revealedAt={unit.revealedAt} />
          <Card title="Audit log" description="Every change to this unit, newest first." bodyClassName="px-4 py-5 md:px-5">
            <AuditList entries={audit} now={now} emptyText="No changes recorded yet." />
          </Card>
        </div>
      </div>
    </>
  );
}

const PATH_LABEL: Record<DeliveryPath, string> = { A: "A · Card in the box", B: "B · Code emailed" };

function PathControl({ unitId, path, onChanged }: { unitId: string; path: DeliveryPath | null; onChanged: () => void }) {
  const [saving, setSaving] = useState<DeliveryPath | null>(null);
  const choose = async (p: DeliveryPath) => {
    if (p === path || saving) return;
    setSaving(p);
    const res = await services.admin.setPath(unitId, p);
    setSaving(null);
    if (!res.ok) {
      toast("The path wasn't changed", { tone: "error", body: res.error.code === "network" ? "Check your connection and try again." : "Try again." });
      return;
    }
    toast(`Path ${p} set`, { tone: "success" });
    onChanged();
  };
  return (
    <div role="group" aria-label="Delivery path" className="inline-flex max-w-full flex-wrap rounded-soft border border-admin-line bg-admin-bg p-0.5">
      {(["A", "B"] as const).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={path === p}
          onClick={() => choose(p)}
          disabled={saving !== null}
          className={cn(
            "min-h-11 rounded-paper px-3 text-sm whitespace-nowrap transition-colors duration-(--motion-dur-fast) pointer-fine:md:min-h-8",
            path === p ? "bg-admin-surface font-medium text-admin-ink shadow-flat" : "text-admin-ink-soft hover:text-admin-ink",
          )}
        >
          {saving === p ? "Saving…" : PATH_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

/** "iPhone · Safari" from a user-agent string (rough, for support only). */
function device(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Unknown device";
  const browser = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} · ${browser}` : os;
}

function RevealEvents({ reveals, revealedAt }: { reveals: RevealEvent[]; revealedAt: string | null }) {
  return (
    <Card title="Reveal history" description="Each time the first-tap reveal played for the recipient.">
      {reveals.length === 0 ? (
        <p className="text-sm text-admin-ink-soft">
          {revealedAt
            ? `Opened on ${dateTime(revealedAt)}. No device details were recorded for this opening.`
            : "Not opened yet. Sender previews never count."}
        </p>
      ) : (
        <ul className="divide-y divide-admin-line/70">
          {reveals.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0">
              <time dateTime={r.at} className="text-admin-ink">
                {dateTime(r.at)}
              </time>
              <span className="flex flex-wrap gap-x-3 text-admin-ink-soft">
                <span>{r.skipped ? "Skipped the opening" : "Watched the opening"}</span>
                <span>Reduced motion: {r.reducedMotion ? "on" : "off"}</span>
                <span>{device(r.userAgent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading unit" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
