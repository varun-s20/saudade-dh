"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { recipientUrl, site } from "@/config/site";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { entropyBits } from "@/lib/parsing/codes";
import { services } from "@/lib/services";
import type { Batch, ProvisionedRow, ServiceErrorCode } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { dateTime } from "@/lib/utils/format";
import { batchFilename, downloadText, rowsToCsv } from "./csv";
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

/** S24: generate a batch of units, preview it, and download the CSV for the NFC encoding run. */
export function BatchScreen() {
  const batches = useServiceQuery(() => services.admin.listBatches(), []);
  useUnauthorizedRedirect(batches.error);

  const [count, setCount] = useState("300");
  const [label, setLabel] = useState("Launch run");
  const [errors, setErrors] = useState<{ count?: string; label?: string }>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batch: Batch; rows: ProvisionedRow[] } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

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
      toast("The batch wasn't generated", { tone: "error", body: FAIL[res.error.code] ?? "Something went wrong. Try again." });
      return;
    }
    setResult(res.data);
    toast("Batch generated", { tone: "success", body: `${res.data.batch.count.toLocaleString()} new units. Download the CSV now.` });
    void batches.reload(true);
  };

  const downloadFresh = () => {
    if (!result) return;
    downloadText(rowsToCsv(result.rows), batchFilename(result.batch.label, result.batch.createdAt));
  };

  const redownload = async (b: Batch) => {
    setDownloading(b.id);
    const res = await services.admin.exportBatchCsv(b.id);
    setDownloading(null);
    if (!res.ok) {
      toast("Couldn't download the CSV", { tone: "error", body: FAIL[res.error.code] ?? "Try again." });
      return;
    }
    downloadText(res.data, batchFilename(b.label, b.createdAt));
  };

  const sampleUrl = recipientUrl("a".repeat(site.ids.slugLength));

  return (
    <>
      <PageHeader
        eyebrow="Saudade admin"
        title="Batches"
        description="Make the identifiers for a production run and download the CSV for the NFC encoding."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card title="Generate a batch" description="Each unit gets an activation code, an NFC slug, and the exact URL for its chip.">
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
              <AdminInput label="Batch name" name="label" value={label} onChange={(e) => setLabel(e.target.value)} error={errors.label} hint="Used in the CSV file name." />
              <AdminButton type="submit" tone="primary" loading={busy} className="sm:mt-7">
                {busy ? "Generating…" : "Generate batch"}
              </AdminButton>
            </form>
          </Card>

          {result && <GeneratedBatch result={result} onDownload={downloadFresh} />}

          <Card
            title="All batches"
            description="Prototype: download any batch again. In production, later downloads carry URLs only; codes are available once, at generation."
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
                        <p className="truncate text-sm font-medium text-admin-ink">{b.label}</p>
                        <p className="text-xs text-admin-ink-soft">
                          {b.count.toLocaleString()} units · created {dateTime(b.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/units?batch=${b.id}`}
                          className="inline-flex min-h-11 items-center rounded-soft px-3 text-sm text-admin-ink-soft hover:bg-admin-line/50 hover:text-admin-ink pointer-fine:md:min-h-9"
                        >
                          View units
                        </Link>
                        <AdminButton onClick={() => redownload(b)} loading={downloading === b.id} className="pointer-fine:md:min-h-9">
                          Download CSV
                        </AdminButton>
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
            {site.codes.alphabet.length} symbols (no 0, O, 1, I or L), about {entropyBits(site.codes.alphabet.length, site.codes.length)} bits. Production length is
            still open (O9: we recommend 8 characters).
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Download the CSV straight away.</strong> In production, codes are stored hashed, so the file
            with codes is produced once, at generation: a card file (unit no. and code, for the printer) and a factory file (unit no. and URL, for the
            encoding run). Later downloads carry URLs only (see ARCHITECTURE.md). The prototype keeps codes, so older batches download in full here.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Unit numbers</strong> (S-0001…) are printed on the card and on the ceramic&apos;s base, so packing
            can pair them. They&apos;re not secret.
          </p>
          <p>
            <strong className="font-medium text-admin-ink">Chip URLs</strong> use the client&apos;s own domain, never a hosting provider&apos;s:
            <span className="mt-1 block font-mono text-xs break-all text-admin-ink">{sampleUrl}</span>
            <span className="mt-1 block text-xs">
              {site.chipDomain} is a placeholder until the domain is confirmed (O2). Each URL is {sampleUrl.length} characters, well within an NTAG213 chip.
            </span>
          </p>
        </aside>
      </div>
    </>
  );
}

function GeneratedBatch({ result, onDownload }: { result: { batch: Batch; rows: ProvisionedRow[] }; onDownload: () => void }) {
  const { batch, rows } = result;
  const filename = batchFilename(batch.label, batch.createdAt);
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
          <AdminButton tone="primary" onClick={onDownload} aria-describedby="csv-once">
            Download CSV
          </AdminButton>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">First {Math.min(PREVIEW_ROWS, rows.length)} rows of the batch CSV</caption>
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
        <strong className="font-medium text-admin-ink">Available once, at generation (production).</strong> File: <span className="font-mono">{filename}</span>
        {rows.length > PREVIEW_ROWS && ` · ${(rows.length - PREVIEW_ROWS).toLocaleString()} more rows in the file`}
      </p>
    </Card>
  );
}
