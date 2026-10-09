/** CSV helpers for the batch provisioning screen (S24). Browser-only for the download. */
import type { ProvisionedRow } from "@/lib/services/types";

/**
 * Same shape as the prototype's service export: `unit_no,code,slug,url`, RFC 4180 quoting,
 * trailing newline. (Production writes a card file and a factory file instead; ARCHITECTURE §5.)
 */
export function rowsToCsv(rows: ProvisionedRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ["unit_no,code,slug,url", ...rows.map((r) => [r.unitNo ?? "", r.code, r.slug, r.url].map(esc).join(","))].join("\n") + "\n";
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

/** saudade-<label-slug>-<yyyy-mm-dd>.csv, dated by the batch's creation (local date). */
export function batchFilename(label: string, createdAtIso: string): string {
  const d = new Date(createdAtIso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `saudade-${labelSlug(label)}-${ymd}.csv`;
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
