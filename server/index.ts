import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { db, seedIfEmpty, EXTRACTABLE_FIELDS, type Company } from "./db.ts";
import { extractEmail, type CompanyRef, type EmailInput } from "./extract.ts";

seedIfEmpty();

const ROOT = join(import.meta.dir, "..");
const PORT = Number(process.env.PORT ?? 3000);
const TODAY = process.env.TODAY ?? new Date().toISOString().slice(0, 10);

const app = new Hono();
app.use("/api/*", cors());

// --- helpers -----------------------------------------------------------------

/** NFKC + lowercase + hiragana->katakana so 「さくら」matches「サクラ」and ABC/ＡＢＣ. */
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = Date.parse(dateStr + "T00:00:00+09:00");
  const t = Date.parse(TODAY + "T00:00:00+09:00");
  if (Number.isNaN(d) || Number.isNaN(t)) return null;
  return Math.round((d - t) / 86_400_000);
}

const UNPAID = new Set(["未払い", "督促中"]);

function alertsFor(c: Company): { alerts: string[]; days_to_renewal: number | null } {
  const alerts: string[] = [];
  const dtr = daysUntil(c.renewal_date);
  if (c.contract_status === "有効" && dtr !== null && dtr >= 0 && dtr <= 30)
    alerts.push("renewal_soon");
  if (UNPAID.has(c.payment_status)) alerts.push("unpaid");
  if (c.invoice_request_status === "未送付") alerts.push("invoice_missing");
  return { alerts, days_to_renewal: dtr };
}

const allCompanies = () =>
  db.query("SELECT * FROM companies ORDER BY id").all() as Company[];

// --- routes ------------------------------------------------------------------

app.get("/api/companies", (c) => {
  const q = c.req.query("q")?.trim();
  let rows = allCompanies();
  if (q) {
    const nq = norm(q);
    rows = rows.filter((r) =>
      norm(`${r.company_name} ${r.kana} ${r.id}`).includes(nq),
    );
  }
  return c.json(
    rows.map((r) => ({ ...r, ...alertsFor(r) })),
  );
});

app.get("/api/companies/:id", (c) => {
  const id = c.req.param("id");
  const company = db
    .query("SELECT * FROM companies WHERE id = ?")
    .get(id) as Company | null;
  if (!company) return c.json({ error: "not found" }, 404);
  const events = db
    .query("SELECT * FROM events WHERE company_id = ? ORDER BY ts DESC, id DESC")
    .all(id);
  const phones = db
    .query("SELECT phone FROM registered_phones WHERE company_id = ?")
    .all(id)
    .map((r: any) => r.phone);
  return c.json({ ...company, ...alertsFor(company), events, phones });
});

// Latest source event for a (company, field) — drives the provenance drawer.
app.get("/api/companies/:id/provenance", (c) => {
  const id = c.req.param("id");
  const field = c.req.query("field") ?? "";
  const event = db
    .query(
      `SELECT * FROM events
       WHERE company_id = ? AND field = ? AND source_email_id IS NOT NULL
       ORDER BY ts DESC, id DESC LIMIT 1`,
    )
    .get(id, field) as any;
  if (!event) return c.json({ event: null, email: null });
  const email = event.source_email_id
    ? db.query("SELECT * FROM emails WHERE id = ?").get(event.source_email_id)
    : null;
  return c.json({ event, email });
});

app.get("/api/attention", (c) => {
  const rows = allCompanies();
  const renewal_soon: Company[] = [];
  const unpaid: Company[] = [];
  const invoice_missing: Company[] = [];
  for (const r of rows) {
    const { alerts } = alertsFor(r);
    if (alerts.includes("renewal_soon")) renewal_soon.push(r);
    if (alerts.includes("unpaid")) unpaid.push(r);
    if (alerts.includes("invoice_missing")) invoice_missing.push(r);
  }
  const shape = (list: Company[]) =>
    list.map((r) => ({ ...r, ...alertsFor(r) }));
  return c.json({
    renewal_soon: { count: renewal_soon.length, companies: shape(renewal_soon) },
    unpaid: { count: unpaid.length, companies: shape(unpaid) },
    invoice_missing: {
      count: invoice_missing.length,
      companies: shape(invoice_missing),
    },
  });
});

app.get("/api/export.csv", (c) => {
  const cols: [string, keyof Company][] = [
    ["企業名", "company_name"],
    ["契約状況", "contract_status"],
    ["契約更新日", "renewal_date"],
    ["支払い状況", "payment_status"],
    ["請求依頼状況", "invoice_request_status"],
    ["会員プラン", "membership_plan"],
    ["担当者", "contact_person"],
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(([h]) => h).join(",")];
  for (const r of allCompanies()) {
    lines.push(cols.map(([, k]) => esc(r[k])).join(","));
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM so Excel-JP reads UTF-8
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="madoguchi_companies.csv"',
    },
  });
});

// --- phones (settings) -------------------------------------------------------

app.get("/api/phones", (c) => {
  const rows = db
    .query(
      `SELECT p.phone, p.company_id, c.company_name
       FROM registered_phones p LEFT JOIN companies c ON c.id = p.company_id
       ORDER BY p.phone`,
    )
    .all();
  return c.json(rows);
});

app.post("/api/phones", async (c) => {
  const { phone, company_id } = await c.req.json<{
    phone: string;
    company_id: string;
  }>();
  if (!phone || !company_id)
    return c.json({ error: "phone and company_id required" }, 400);
  db.query(
    "INSERT OR REPLACE INTO registered_phones (phone, company_id) VALUES (?, ?)",
  ).run(phone, company_id);
  return c.json({ ok: true });
});

app.delete("/api/phones/:phone", (c) => {
  db.query("DELETE FROM registered_phones WHERE phone = ?").run(
    c.req.param("phone"),
  );
  return c.json({ ok: true });
});

// --- calls -------------------------------------------------------------------

app.post("/api/calls", async (c) => {
  const { company_id, transcript, summary_ja } = await c.req.json<{
    company_id: string;
    transcript: string;
    summary_ja: string;
  }>();
  const ts = new Date().toISOString();
  db.query(
    `INSERT INTO events (company_id, ts, kind, summary_ja, transcript, needs_review)
     VALUES (?, ?, 'call', ?, ?, 0)`,
  ).run(company_id, ts, summary_ja ?? "", transcript ?? "");
  return c.json({ ok: true });
});

// --- event acknowledgement (確認済みにする) -----------------------------------

app.post("/api/events/:id/ack", (c) => {
  const id = Number(c.req.param("id"));
  const ev = db.query("SELECT * FROM events WHERE id = ?").get(id) as any;
  if (!ev) return c.json({ error: "not found" }, 404);
  // Approving a proposed status change applies it to the company row.
  if (
    ev.company_id &&
    ev.field &&
    (EXTRACTABLE_FIELDS as readonly string[]).includes(ev.field) &&
    ev.new_value
  ) {
    db.query(`UPDATE companies SET ${ev.field} = ? WHERE id = ?`).run(
      ev.new_value,
      ev.company_id,
    );
  }
  db.query("UPDATE events SET needs_review = 0 WHERE id = ?").run(id);
  return c.json({ ok: true });
});

// --- ingest: raw email -> Kimi extraction -> apply + provenance events --------

app.post("/api/ingest", async (c) => {
  const { emails } = await c.req.json<{ emails: EmailInput[] }>();
  if (!Array.isArray(emails))
    return c.json({ error: "emails array required" }, 400);

  const companyList: CompanyRef[] = allCompanies().map((r) => ({
    id: r.id,
    company_name: r.company_name,
    kana: r.kana,
  }));

  const upsertEmail = db.query(
    `INSERT OR REPLACE INTO emails (id, received_at, from_addr, subject, body)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insEvent = db.query(
    `INSERT INTO events
       (company_id, ts, kind, field, old_value, new_value, source_email_id,
        source_quote, summary_ja, confidence, needs_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const results = [];
  for (const email of emails) {
    upsertEmail.run(
      email.id,
      email.received_at,
      email.from_addr,
      email.subject,
      email.body,
    );

    let extraction;
    try {
      extraction = await extractEmail(email, companyList, TODAY);
    } catch (err) {
      results.push({
        email_id: email.id,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const cid = extraction.company_match.company_id;
    const company = cid
      ? (db.query("SELECT * FROM companies WHERE id = ?").get(cid) as Company | null)
      : null;
    const ts = email.received_at || new Date().toISOString();

    // Timeline marker: this email was ingested.
    insEvent.run(
      company?.id ?? null,
      ts,
      "email",
      null,
      null,
      null,
      email.id,
      null,
      extraction.summary_ja,
      extraction.company_match.confidence,
      company ? 0 : 1,
    );

    const applied: { field: string; old: string; new: string }[] = [];
    const review: { field: string; new: string; confidence: number }[] = [];

    for (const u of extraction.updates) {
      const isField =
        u.field !== "note" &&
        (EXTRACTABLE_FIELDS as readonly string[]).includes(u.field);
      const highConf = u.confidence >= 0.8;
      const canApply = Boolean(company) && isField && highConf;

      if (u.field === "note" || !isField) {
        insEvent.run(
          company?.id ?? null,
          ts,
          "note",
          "note",
          null,
          u.new_value,
          email.id,
          u.source_quote,
          extraction.summary_ja,
          u.confidence,
          u.confidence < 0.8 ? 1 : 0,
        );
        continue;
      }

      const oldVal = company ? (company as any)[u.field] : null;
      if (canApply) {
        db.query(`UPDATE companies SET ${u.field} = ? WHERE id = ?`).run(
          u.new_value,
          company!.id,
        );
        (company as any)[u.field] = u.new_value;
        insEvent.run(
          company!.id,
          ts,
          "status_change",
          u.field,
          oldVal,
          u.new_value,
          email.id,
          u.source_quote,
          extraction.summary_ja,
          u.confidence,
          0,
        );
        applied.push({ field: u.field, old: oldVal ?? "", new: u.new_value });
      } else {
        // Low confidence or unmatched company: propose, don't apply.
        insEvent.run(
          company?.id ?? null,
          ts,
          "status_change",
          u.field,
          oldVal,
          u.new_value,
          email.id,
          u.source_quote,
          extraction.summary_ja,
          u.confidence,
          1,
        );
        review.push({ field: u.field, new: u.new_value, confidence: u.confidence });
      }
    }

    results.push({
      email_id: email.id,
      company_id: company?.id ?? null,
      company_name: company?.company_name ?? extraction.company_match.name_raw,
      classification: extraction.classification,
      summary_ja: extraction.summary_ja,
      applied,
      review,
      needs_human_review: extraction.needs_human_review,
    });
  }

  return c.json({ results });
});

// --- sample emails for the demo ingest panel (data/emails/*.md) --------------
app.get("/api/sample-emails", async (c) => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = join(ROOT, "data", "emails");
  const out = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf-8");
      const m = text.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
      const fm: Record<string, string> = {};
      if (m)
        for (const line of m[1].split("\n")) {
          const kv = line.match(/^(\w+):\s*(.*)$/);
          if (kv) fm[kv[1]] = kv[2].trim();
        }
      return {
        file: f,
        id: fm.id ?? f,
        received_at: fm.received_at ?? "",
        from_addr: fm.from ?? "",
        subject: fm.subject ?? "",
        body: (m ? m[2] : text).trim(),
      };
    });
  return c.json(out);
});

// --- serve built frontend (production) --------------------------------------
const dist = join(ROOT, "web", "dist");
if (existsSync(dist)) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  app.get("/*", serveStatic({ path: "./web/dist/index.html" }));
}

console.log(`[server] MADOGUCHI API on http://localhost:${PORT}  (today=${TODAY})`);

export default { port: PORT, fetch: app.fetch, idleTimeout: 120 };
