"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PLACEHOLDER_CHIP_DOMAIN, recipientUrl, site } from "@/config/site";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { entropyBits } from "@/lib/parsing/codes";
import { NTAG213_BYTES, ndefBytes } from "@/lib/parsing/ndef";
import { dataSource, services } from "@/lib/services";
import type { Batch, BatchStatus, ProvisionedRow, ServiceError, ServiceErrorCode } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { cn } from "@/lib/utils/cn";
import { dateTime, plural } from "@/lib/utils/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { batchFilename, cardsCsv, downloadText, factoryCsv } from "./csv";
import { loadErrorText, useUnauthorizedRedirect } from "./DashboardScreen";
import { EmptyState } from "./EmptyState";
import { AdminButton, AdminInput, Card, LoadError, PageHeader, Skeleton } from "./ui";

const MAX_BATCH = 5000;
const PREVIEW_ROWS = 10;

const FAIL: Partial<Record<ServiceErrorCode, string>> = {
  network: "We couldn't reach the server. Check your connection and try again.",
  unauthorized: "Your admin session has ended. Sign in again.",
  not_found: "That batch has no units to export.",
  invalid_input: "Check the number of units and the batch name.",
};

const failText = (e: ServiceError, fallback = "Something went wrong. Try again.") => (e.code === "invalid_input" && e.detail ? `Refused: ${e.detail}.` : (FAIL[e.code] ?? fallback));

const STATUS: Record<BatchStatus, { label: string; className: string }> = {
  generated: { label: "Generated", className: "border-admin-ink/30 text-admin-ink-soft" },
  encoded: { label: "Encoded", className: "border-navy bg-navy text-ink-inverse" },
  void: { label: "Void", className: "border-danger text-danger line-through" },
};

type Pending = { kind: "encode" | "void"; batch: Batch } | null;

/**
 * S24: the provisioning ceremony (ARCHITECTURE.md §3.6). Generate a batch, download its two files
 * at once (the card file with the codes, for the printer; the factory file with the chip URLs, for
 * the encoding run), mark it encoded when the factory confirms, or void it if the files were lost
 * before encoding.
 */
export function BatchScreen() {
  const batches = useServiceQuery(() => services.admin.listBatches(), []);
  useUnauthorizedRedirect(batches.error);

  const [count, setCount] = useState("300");
  const [label, setLabel] = useState("Launch run");
  const [errors, setErrors] = useState<{ count?: string; label?: string }>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batch: Batch; rows: ProvisionedRow[] } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [acting, setActing] = useState(false);

  const placeholderDomain = site.chipDomain === PLACEHOLDER_CHIP_DOMAIN;

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(count);
    const next: typeof errors = {};
    if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH) next.count = `Enter a whole number from 1 to ${MAX_BATCH.toLocaleString()}.`;
    if (!label.trim()) next.label = "Give the batch a name, like “Launch run”.";
    setErrors(next);
    if (next.count || next.label) return;

    setBusy(true);
    const res = await services.admin.generateBatch(n, label.trim());
    setBusy(false);
    if (!res.ok) {
      toast("The batch wasn't generated", { tone: "error", body: failText(res.error) });
      return;
    }
    setResult(res.data);
    toast("Batch generated", { tone: "success", body: `${res.data.batch.count.toLocaleString()} new units. Download both files now.` });
    void batches.reload(true);
  };

  const redownload = async (b: Batch) => {
    setDownloading(b.id);
    const res = await services.admin.exportBatchCsv(b.id);
    setDownloading(null);
    if (!res.ok) {
      toast("Couldn't download the CSV", { tone: "error", body: failText(res.error, "Try again.") });
      return;
    }
    downloadText(res.data, batchFilename(b.label, b.createdAt, dataSource === "api" ? "factory" : undefined));
  };

  const act = async () => {
    if (!pending) return;
    setActing(true);
    const res = pending.kind === "encode" ? await services.admin.markBatchEncoded(pending.batch.id) : await services.admin.voidBatch(pending.batch.id);
    setActing(false);
    setPending(null);
    if (!res.ok) {
      toast(pending.kind === "encode" ? "Not marked as encoded" : "Not voided", { tone: "error", body: failText(res.error) });
      return;
    }
    toast(pending.kind === "encode" ? "Marked as encoded" : "Batch voided", {
      tone: "success",
      body: pending.kind === "encode" ? "Its chips are now permanent: it can never be voided." : "Its codes no longer work. Generate a replacement batch.",
    });
    void batches.reload(true);
  };

  const sampleUrl = recipientUrl("a".repeat(site.ids.slugLength));

  return (
    <>
      <PageHeader
        eyebrow="Saudade admin"
        title="Batches"
        description="Make the identifiers for a production run, then hand the card file to the printer and the factory file to the encoding run."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card title="Generate a batch" description="Each unit gets an activation code, an NFC slug, and the exact URL for its chip.">
            {(placeholderDomain || site.codes.length === 4) && dataSource === "api" && (
              <div role="note" className="mb-4 rounded-soft border-2 border-ochre bg-ochre/15 px-4 py-3 text-sm text-admin-ink">
                <p className="font-semibold">Not ready for the launch batch yet</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {placeholderDomain && <li>The chip domain is still the placeholder {PLACEHOLDER_CHIP_DOMAIN}: batches made now are for testing only and must never be encoded.</li>}
                  {site.codes.length === 4 && <li>Codes are 4 characters (SAUD-XXXX). We recommend 8 for every production unit (O9).</li>}
                </ul>
                <p className="mt-1 text-xs text-admin-ink-soft">See the launch checklist on the dashboard.</p>
              </div>
            )}
            <form onSubmit={generate} noValidate className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
              <AdminInput
                label="Units"
                name="count"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_BATCH}
                step={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                error={errors.count}
              />
              <AdminInput label="Batch name" name="label" value={label} onChange={(e) => setLabel(e.target.value)} error={errors.label} hint="Used in the file names." />
              <AdminButton type="submit" tone="primary" loading={busy} className="sm:mt-7">
                {busy ? "Generating…" : "Generate batch"}
              </AdminButton>
            </form>
          </Card>

          {result && <GeneratedBatch result={result} />}

          <Card
            title="All batches"
            description={
              dataSource === "api"
                ? "Later downloads are the factory file only (URLs, no codes): codes exist once, at generation."
                : "Prototype: download any batch again, codes included. The live system gives codes only once, at generation."
            }
            bodyClassName="p-0"
          >
            {batches.status === "loading" && (
              <div className="space-y-3 p-5" aria-busy="true">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            )}
            {batches.status === "error" && batches.error.code !== "unauthorized" && (
              <div className="p-4">
                <LoadError message={loadErrorText(batches.error)} onRetry={() => batches.reload()} />
              </div>
            )}
            {batches.status === "success" &&
              (batches.data.length === 0 ? (
                <EmptyState title="No batches yet" body="Generate the first one above." />
              ) : (
                <ul className="divide-y divide-admin-line">
                  {batches.data.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-admin-ink">
                          <span className="truncate">{b.label}</span>
                          <span className={cn("rounded-soft border px-1.5 py-px text-[0.7rem] font-semibold tracking-wide uppercase", STATUS[b.status].className)}>
                            {STATUS[b.status].label}
                          </span>
                        </p>
                        <p className="text-xs text-admin-ink-soft">
                          {b.count.toLocaleString()} {plural(b.count, "unit")} · {b.claimedCount.toLocaleString()} claimed · {b.codeLength}-character codes ·{" "}
                          {b.chipDomain}
                        </p>
                        <p className="text-xs text-admin-ink-soft">
                          Created {dateTime(b.createdAt)}
                          {b.encodedAt && ` · encoded ${dateTime(b.encodedAt)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/units?batch=${b.id}`}
                          className="inline-flex min-h-11 items-center rounded-soft px-3 text-sm text-admin-ink-soft hover:bg-admin-line/50 hover:text-admin-ink pointer-fine:md:min-h-9"
                        >
                          View units
                        </Link>
                        {b.status !== "void" && (
                          <AdminButton onClick={() => redownload(b)} loading={downloading === b.id} className="pointer-fine:md:min-h-9">
                            {dataSource === "api" ? "Factory CSV" : "Download CSV"}
                          </AdminButton>
                        )}
                        {b.status === "generated" && (
                          <AdminButton onClick={() => setPending({ kind: "encode", batch: b })} className="pointer-fine:md:min-h-9">
                            Mark encoded…
                          </AdminButton>
                        )}
                        {b.status === "generated" && b.claimedCount === 0 && (
                          <AdminButton tone="quiet" onClick={() => setPending({ kind: "void", batch: b })} className="text-danger pointer-fine:md:min-h-9">
                            Void…
                          </AdminButton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </Card>
        </div>

        <aside aria-label="About the identifiers" className="space-y-4 rounded-card border border-dashed border-paper-edge bg-paper/60 p-4 text-sm text-admin-ink-soft md:p-5">
          <h2 className="postal-label text-admin-ink">About these identifiers</h2>
          <p>
            <strong className="font-medium text-admin-ink">Random, never sequential.</strong> Codes and slugs come from a cryptographic random source, so
            neighbouring units share no pattern and can&apos;t be guessed from each other.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Codes:</strong> {site.codes.prefix}- plus {site.codes.length} characters from{" "}
            {site.codes.alphabet.length} symbols (no 0, O, 1, I or L), about {entropyBits(site.codes.alphabet.length, site.codes.length)} bits.
            {site.codes.length === 4 && " We recommend 8 characters for production (O9): set NEXT_PUBLIC_CODE_LENGTH=8."}
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Two files, once.</strong> Codes are stored hashed, so the files with codes exist only at
            generation: the <em>card file</em> (unit no. and code) goes to the printer and is deleted once the cards are checked; the <em>factory file</em>{" "}
            (unit no. and URL) goes to the encoding run and can be downloaded again any time.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Encoded is permanent.</strong> Mark a batch encoded when the factory confirms its chips are written
            and locked. Until then, a batch whose files were lost can be voided: its codes stop working and you generate a new one.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Unit numbers</strong> (S-0001…) are printed on the card and on the ceramic&apos;s base, so packing
            can pair them. They&apos;re not secret.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Chip URLs</strong> use Saudade&apos;s own domain, never a hosting provider&apos;s:
            <span className="mt-1 block font-mono text-xs break-all text-admin-ink">{sampleUrl}</span>
            <span className="mt-1 block text-xs">
              {placeholderDomain && `${site.chipDomain} is a placeholder until the domain is confirmed (O2). `}
              Each record is {ndefBytes(sampleUrl)} of the NTAG213&apos;s {NTAG213_BYTES} bytes.
            </span>
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={act}
        busy={acting}
        tone={pending?.kind === "void" ? "danger" : "primary"}
        title={pending?.kind === "void" ? `Void “${pending.batch.label}”?` : `Mark “${pending?.batch.label ?? ""}” as encoded?`}
        confirmLabel={pending?.kind === "void" ? "Void batch" : "Mark encoded"}
      >
        {pending?.kind === "void" ? (
          <p className="text-sm leading-relaxed text-admin-ink">
            Its {pending.batch.count.toLocaleString()} codes stop working for good, and its units can never be claimed. Do this only if the card or factory
            file was lost or leaked <strong>before</strong> any chip was written. Then generate a new batch.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-admin-ink">
            Confirm the factory has written, checked and locked every chip in this batch. This can&apos;t be undone: from now on its URLs exist on ceramics, so the
            batch can never be voided.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function GeneratedBatch({ result }: { result: { batch: Batch; rows: ProvisionedRow[] } }) {
  const { batch, rows } = result;
  const [got, setGot] = useState<{ cards?: boolean; factory?: boolean }>({});
  const download = (kind: "cards" | "factory") => {
    downloadText(kind === "cards" ? cardsCsv(rows) : factoryCsv(rows), batchFilename(batch.label, batch.createdAt, kind));
    setGot((g) => ({ ...g, [kind]: true }));
  };
  return (
    <Card
      title={`Ready: ${batch.label}`}
      description={`${batch.count.toLocaleString()} units. Showing the first ${Math.min(PREVIEW_ROWS, rows.length)}.`}
      actions={
        <>
          <Link
            href={`/admin/units?batch=${batch.id}`}
            className="inline-flex min-h-11 items-center rounded-soft px-3 text-sm text-admin-ink-soft hover:bg-admin-line/50 hover:text-admin-ink pointer-fine:md:min-h-10"
          >
            View units
          </Link>
          <AdminButton tone="primary" onClick={() => download("cards")} aria-describedby="csv-once">
            {got.cards ? "Card file again" : "Card file (codes)"}
          </AdminButton>
          <AdminButton tone="primary" onClick={() => download("factory")}>
            {got.factory ? "Factory file again" : "Factory file (URLs)"}
          </AdminButton>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">First {Math.min(PREVIEW_ROWS, rows.length)} units of the batch</caption>
          <thead>
            <tr className="border-b border-admin-line">
              {["unit_no", "code", "slug", "url"].map((h) => (
                <th key={h} scope="col" className="px-4 py-2 font-mono text-xs font-normal text-admin-ink-soft first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_ROWS).map((r) => (
              <tr key={r.slug} className="border-b border-admin-line/70 last:border-0">
                <td className="px-4 py-2 pl-5 whitespace-nowrap text-admin-ink-soft tabular-nums">{r.unitNo}</td>
                <td className="px-4 py-2 font-postal tracking-wide whitespace-nowrap text-admin-ink">{r.code}</td>
                <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-admin-ink-soft">{r.slug}</td>
                <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-admin-ink">{r.url}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id="csv-once" className="border-t border-admin-line px-5 py-2.5 text-xs text-admin-ink-soft">
        <strong className="font-medium text-admin-ink">The codes exist only on this screen.</strong> Download the card file before leaving; the factory file can be
        downloaded again later.
        {rows.length > PREVIEW_ROWS && ` ${(rows.length - PREVIEW_ROWS).toLocaleString()} more rows in each file.`}
      </p>
    </Card>
  );
}
