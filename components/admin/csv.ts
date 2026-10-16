/** CSV helpers for the batch provisioning screen (S24). Browser-only for the download. */
import { ndefBytes } from "@/lib/parsing/ndef";
import type { ProvisionedRow } from "@/lib/services/types";

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = (header: string, rows: string[][]) => [header, ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";

/** Everything in one file: `unit_no,code,slug,url` (the prototype's own export). */
export function rowsToCsv(rows: ProvisionedRow[]): string {
  return csv("unit_no,code,slug,url", rows.map((r) => [r.unitNo ?? "", r.code, r.slug, r.url]));
}

/**
 * The CARD file, for the printer: `unit_no,code`. Secret: it exists once, at generation (codes are
 * stored hashed), and should be deleted once the cards are printed (ARCHITECTURE.md §3.6).
 */
export function cardsCsv(rows: ProvisionedRow[]): string {
  return csv("unit_no,code", rows.map((r) => [r.unitNo ?? "", r.code]));
}

/** The FACTORY file, for the encoding run: `unit_no,slug,url,ndef_bytes`. No codes in it. */
export function factoryCsv(rows: ProvisionedRow[]): string {
  return csv("unit_no,slug,url,ndef_bytes", rows.map((r) => [r.unitNo ?? "", r.slug, r.url, String(ndefBytes(r.url))]));
}

/** "Launch run · 300" → "launch-run-300" */
export function labelSlug(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "batch"
  );
}

/** saudade-[kind-]<label-slug>-<yyyy-mm-dd>.csv, dated by the batch's creation (local date). */
export function batchFilename(label: string, createdAtIso: string, kind?: "cards" | "factory"): string {
  const d = new Date(createdAtIso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `saudade-${kind ? `${kind}-` : ""}${labelSlug(label)}-${ymd}.csv`;
}

/** Trigger a file download from text (Blob + temporary object URL). */
export function downloadText(text: string, filename: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
