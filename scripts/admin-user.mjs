/**
 * Admin accounts, from a terminal only (there is no sign-up page, by design: ARCHITECTURE.md §9.4).
 *
 *   npm run admin -- list
 *   npm run admin -- add <email> [--name "Developer"]   prints a generated password, once
 *   npm run admin -- reset-password <email>             prints a new password; signs them out everywhere
 *   npm run admin -- disable <email> | enable <email>
 *   … --env-file <file>                                  default .env.local
 *
 * Every change is written to the audit log (actor "system").
 */
import { connect, fail, hashPassword, loadEnv, newPassword, parseArgs } from "./lib/ops-common.mjs";

const args = parseArgs();
loadEnv(args["env-file"]);
const [command, rawEmail] = args._;
const email = rawEmail?.trim().toLowerCase();
const COMMANDS = ["list", "add", "reset-password", "disable", "enable"];
if (!COMMANDS.includes(command)) fail(`Usage: npm run admin -- <${COMMANDS.join("|")}> [email]`);
if (command !== "list" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")) fail("Give the admin's email address.");

const sql = connect();
const logged = (action, adminId, text) => sql`insert into audit_log (action, actor, admin_id, detail) values (${action}, 'system', ${adminId}, ${sql.json({ text })})`;
const revokeSessions = (id) => sql`update admin_sessions set revoked_at = now() where admin_id = ${id} and revoked_at is null`;

try {
  if (command === "list") {
    const rows = await sql`
      select email::text as email, display_name, last_sign_in_at, disabled_at, locked_until
      from admin_users order by created_at`;
    if (!rows.length) console.log("No admins yet: npm run admin -- add <email>");
    for (const r of rows) {
      const state = r.disabled_at ? "DISABLED" : r.locked_until && r.locked_until > new Date() ? "locked" : "active";
      console.log(`${r.email.padEnd(36)} ${state.padEnd(8)} last sign-in ${r.last_sign_in_at?.toISOString().slice(0, 16) ?? "never"}`);
    }
  } else if (command === "add") {
    const password = newPassword();
    const [row] = await sql`
      insert into admin_users (email, display_name, password_hash) values (${email}, ${String(args.name ?? "").slice(0, 80) || null}, ${hashPassword(password)})
      on conflict (email) do nothing returning id`;
    if (!row) fail(`${email} is already an admin (use reset-password).`);
    await logged("admin.created", row.id, email);
    console.log(`✓ Admin ${email} created.\n  Password: ${password}\n  Hand it over in person or through the password manager, never by email.`);
  } else {
    const [admin] = await sql`select id from admin_users where email = ${email}`;
    if (!admin) fail(`No admin with the email ${email}.`);
    if (command === "reset-password") {
      const password = newPassword();
      await sql`update admin_users set password_hash = ${hashPassword(password)}, failed_sign_ins = 0, locked_until = null where id = ${admin.id}`;
      await revokeSessions(admin.id);
      await logged("admin.password_reset", admin.id, email);
      console.log(`✓ New password for ${email}: ${password}\n  Every session of theirs was signed out.`);
    } else if (command === "disable") {
      await sql`update admin_users set disabled_at = now() where id = ${admin.id}`;
      await revokeSessions(admin.id);
      await logged("admin.disabled", admin.id, email);
      console.log(`✓ ${email} can no longer sign in; their sessions were ended.`);
    } else if (command === "enable") {
      await sql`update admin_users set disabled_at = null, failed_sign_ins = 0, locked_until = null where id = ${admin.id}`;
      await logged("admin.enabled", admin.id, email);
      console.log(`✓ ${email} can sign in again.`);
    }
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await sql.end();
}
