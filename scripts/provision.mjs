/**
 * The provisioning ceremony from a terminal (ARCHITECTURE.md §3.6; the admin's Batches page does
 * the same in a browser). Creates a batch of units in one transaction and writes its two files:
 *
 *   cards-<label>-<date>.csv     unit_no,code                    → the card printer. SECRET: the
 *                                                                   only copy of the codes ever.
 *   factory-<label>-<date>.csv   unit_no,slug,url,ndef_bytes     → the NFC encoding run.
 *
 *   npm run provision -- --count 300 --label "Launch run" --env-file .env.production.local
 *       … shows the plan and changes nothing; add --yes to generate.
 *   … --out <dir>             where to write the files (default ./provision-out, git-ignored)
 *   … --allow-placeholder     allow the placeholder chip domain (staging tests only)
 *
 * It reads NEXT_PUBLIC_CHIP_DOMAIN and NEXT_PUBLIC_CODE_LENGTH from the env file: they must match
 * the production build, or the claim page and the cards will disagree.
 */
import fs from "node:fs";
import path from "node:path";
import { codeBody, codeHash, connect, fail, formatCode, loadEnv, ndefBytes, parseArgs, randomString, B32, requireEnv, toCsv, unitNo } from "./lib/ops-common.mjs";

const PLACEHOLDER = "saudade.example";
const args = parseArgs();
const envFile = loadEnv(args["env-file"]);
requireEnv("DATABASE_URL", "CODE_PEPPER_V1");

const count = Number(args.count ?? 0);
if (!Number.isInteger(count) || count < 1 || count > 5000) fail("--count must be a whole number from 1 to 5000.");
const label = String(args.label ?? "").trim().slice(0, 80);
if (!label) fail('--label is required, e.g. --label "Launch run".');
const domain = (process.env.NEXT_PUBLIC_CHIP_DOMAIN?.trim().toLowerCase() || PLACEHOLDER);
const codeLength = process.env.NEXT_PUBLIC_CODE_LENGTH?.trim() === "8" ? 8 : 4;
if (domain === PLACEHOLDER && !args["allow-placeholder"]) fail(`NEXT_PUBLIC_CHIP_DOMAIN is unset (placeholder ${PLACEHOLDER}). Chips are permanent: set the real domain (O2).`);
if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) fail(`"${domain}" is not a valid domain.`);
const outDir = path.resolve(String(args.out ?? "provision-out"));
const stamp = new Date().toISOString().slice(0, 10);
const slugLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "batch";
const sampleUrl = `https://${domain}/t/${"a".repeat(12)}`;

console.log(`Env file      ${path.basename(envFile)}`);
console.log(`Batch         "${label}", ${count} units`);
console.log(`Chip URLs     https://${domain}/t/<12 characters>  (${ndefBytes(sampleUrl)} of 144 NTAG213 bytes)`);
console.log(`Codes         ${formatCode("X".repeat(codeLength))}${codeLength === 4 ? "   ! 4 characters: we recommend 8 for production (O9)" : ""}`);
console.log(`Files         ${outDir}`);
if (!args.yes) {
  console.log("\nDry run: nothing was changed. Re-run with --yes to generate.");
  process.exit(0);
}

const sql = connect();
try {
  const rows = await sql.begin(async (t) => {
    const [b] = await t`
      insert into batches (label, unit_count, code_length, chip_domain) values (${label}, ${count}, ${codeLength}, ${domain}) returning id`;
    const made = [];
    for (let round = 0; made.length < count && round < 10; round++) {
      const missing = count - made.length;
      for (let done = 0; done < missing; ) {
        const n = Math.min(500, missing - done);
        const draft = Array.from({ length: n }, () => {
          const body = codeBody(codeLength);
          return { body, slug: randomString(B32, 12) };
        });
        const inserted = await t`
          insert into units ${t(draft.map((d) => ({ batch_id: b.id, slug: d.slug, code_hash: codeHash(d.body) })))}
          on conflict do nothing returning unit_no, slug`;
        const bySlug = new Map(draft.map((d) => [d.slug, d.body]));
        for (const r of inserted) made.push({ no: r.unit_no, slug: r.slug, code: formatCode(bySlug.get(r.slug)) });
        done += n;
      }
    }
    if (made.length !== count) throw new Error("batch generation kept colliding");
    await t`insert into audit_log (action, actor, detail) values ('batch.generated', 'system', ${t.json({ text: `${label}: ${count} units, ${codeLength}-char codes, ${domain} (CLI)` })})`;
    return made.sort((a, z) => a.no - z.no);
  });

  fs.mkdirSync(outDir, { recursive: true });
  const cards = path.join(outDir, `cards-${slugLabel}-${stamp}.csv`);
  const factory = path.join(outDir, `factory-${slugLabel}-${stamp}.csv`);
  fs.writeFileSync(cards, toCsv("unit_no,code", rows.map((r) => [unitNo(r.no), r.code])), { mode: 0o600 });
  fs.writeFileSync(
    factory,
    toCsv("unit_no,slug,url,ndef_bytes", rows.map((r) => {
      const url = `https://${domain}/t/${r.slug}`;
      return [unitNo(r.no), r.slug, url, ndefBytes(url)];
    })),
    { mode: 0o600 },
  );
  console.log(`\n✓ ${rows.length} units, ${unitNo(rows[0].no)}–${unitNo(rows.at(-1).no)}`);
  console.log(`  Card file     ${cards}`);
  console.log(`  Factory file  ${factory}`);
  console.log("\nNext:");
  console.log("  1. Put both files in the vault now. The card file is the ONLY copy of the codes.");
  console.log("  2. Card file → printer; factory file → the encoding run. Delete your local copies.");
  console.log("  3. When the factory confirms every chip is written and locked: Admin → Batches → Mark encoded.");
  console.log("  4. Lost a file before encoding? Admin → Batches → Void, then run this again.");
} catch (e) {
  fail(`Nothing was created: ${e instanceof Error ? e.message : e}`);
} finally {
  await sql.end();
}
