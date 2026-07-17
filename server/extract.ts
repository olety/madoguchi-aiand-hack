// Email -> structured status extraction. Kimi K2.7 (via the ai& proxy) is the
// only brain here. Mirrors prompts/extraction-prompt.md — iterate them together.

const AI_BASE_URL = process.env.AI_BASE_URL ?? "http://127.0.0.1:8317/v1";
const AI_API_KEY = process.env.AI_API_KEY ?? "";
const AI_MODEL = process.env.AI_MODEL ?? "kimi-k2.7-code";

export type CompanyRef = { id: string; company_name: string; kana: string };

export type EmailInput = {
  id: string;
  received_at: string;
  from_addr: string;
  subject: string;
  body: string;
};

export type ExtractionUpdate = {
  field:
    | "payment_status"
    | "invoice_request_status"
    | "contract_status"
    | "renewal_date"
    | "note";
  new_value: string;
  source_quote: string;
  confidence: number;
};

export type ExtractionResult = {
  email_id: string;
  company_match: {
    name_raw: string;
    company_id: string | null;
    confidence: number;
  };
  classification:
    | "payment"
    | "renewal"
    | "invoice_request"
    | "cancellation"
    | "other"
    | "no_action";
  summary_ja: string;
  updates: ExtractionUpdate[];
  needs_human_review: boolean;
};

// --- System prompt (kept in sync with prompts/extraction-prompt.md) ----------
function buildSystemPrompt(companyList: CompanyRef[], today: string): string {
  const listJson = JSON.stringify(
    companyList.map((c) => ({
      id: c.id,
      company_name: c.company_name,
      kana: c.kana,
    })),
    null,
    0,
  );
  return `あなたは会員企業管理システムのデータ抽出エンジンです。施設運営スタッフ宛のメールを読み、
会員企業のステータス変更を構造化データとして抽出します。

今日の日付: ${today}

会員企業リスト（この中からのみ照合すること）:
${listJson}

ルール:
1. メールが会員企業リストのどの企業に関するものか照合する。社名の表記ゆれ（略称、
   カナ、英語表記、「様」「御中」付き）を考慮する。確信が持てない場合は company_id を
   null にし、needs_human_review を true にする。
2. 抽出対象フィールドは payment_status / invoice_request_status / contract_status /
   renewal_date / note のみ。それ以外の情報（プラン変更希望、住所変更など）は
   field="note" として記録する。
3. 【最重要】updates の各項目には source_quote として、その判断の根拠となった
   メール本文中に実在する一続きの文を引用すること。要約・言い換え・存在しない
   文の作成は禁止。文字は本文からそのままコピーする（改行や空白の差異のみ許容）。
   引用記号（>）は取り除き、根拠となる一文だけを引用する。この引用文は原文との
   照合に使われるため、本文に無い語を足してはならない。
4. ステータス変更を含まないメール（挨拶、ノイズ、一斉送信のお知らせ）は
   classification="no_action" とし、updates は空配列にする。無理に抽出しない。
5. 金額・日付は本文に書かれたものだけを使う。推測で補完しない。相対的な日付表現
   （「来月」等）は today を基準に YYYY-MM-DD へ変換してよいが、本文に日付が
   無い場合は renewal_date を出力しない。
6. confidence は 0.0〜1.0。0.8 未満の update がある場合、または company_id が null の
   場合は needs_human_review を true にする。
7. 支払いの判定:
   - 既に振込・入金が「完了した」旨の連絡（例:「振込みました」「入金いたしました」
     「お振込みいたしました」）は payment_status="支払い済み"。着金確認の依頼が
     添えられていても、送金完了の記載があれば「支払い済み」とする。
   - 将来の入金「予定」の連絡（例:「◯月◯日までに振り込みます」「入金予定」）は
     payment_status を変更せず（未払い/督促中のまま）、予定内容は field="note" に記録。

許可される値:
- payment_status: 支払い済み | 入金待ち | 未払い | 督促中
- invoice_request_status: 送付済み | 未送付 | 作成中 | 不要
- contract_status: 有効 | 更新手続き中 | 解約予定 | 新規申込中
- renewal_date: YYYY-MM-DD
- classification: payment | renewal | invoice_request | cancellation | other | no_action

出力は必ず \`\`\`json フェンスで囲んだ単一のJSONオブジェクトのみとする。
フェンスの外に説明文を書かない。スキーマ:
{
  "email_id": string,
  "company_match": { "name_raw": string, "company_id": string|null, "confidence": number },
  "classification": string,
  "summary_ja": string(40字以内),
  "updates": [ { "field": string, "new_value": string, "source_quote": string, "confidence": number } ],
  "needs_human_review": boolean
}`;
}

function userMessage(email: EmailInput): string {
  return `email_id: ${email.id}
received_at: ${email.received_at}
from: ${email.from_addr}
subject: ${email.subject}

--- 本文 ---
${email.body}`;
}

// --- LLM call ----------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chat(
  messages: { role: string; content: string }[],
  jsonMode: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: AI_MODEL,
    messages,
    temperature: 0,
    max_tokens: 2048,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  // ai& occasionally returns transient 502/503 on model cold-start. Retry with
  // backoff so a blip doesn't fail the whole ingest.
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 45_000);
  let lastErr = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);
    // Abort a hung generation so it retries fast instead of blocking the request.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? "";
      }
      const text = await res.text();
      lastErr = `LLM HTTP ${res.status}: ${text.slice(0, 300)}`;
      if (!RETRYABLE.has(res.status)) break;
    } catch (e) {
      lastErr =
        e instanceof Error && e.name === "AbortError"
          ? `LLM timeout after ${TIMEOUT_MS}ms`
          : `LLM fetch error: ${e instanceof Error ? e.message : String(e)}`;
      // network/timeout errors are retryable
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastErr);
}

function parseJsonLoose(content: string): any {
  // Prefer a fenced ```json block; fall back to first {...} span.
  const fence = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/i);
  const candidate = fence
    ? fence[1]
    : content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  return JSON.parse(candidate.trim());
}

function normalize(
  raw: any,
  email: EmailInput,
): ExtractionResult {
  const updates: ExtractionUpdate[] = Array.isArray(raw?.updates)
    ? raw.updates
        .filter((u: any) => u && u.field && u.new_value != null)
        .map((u: any) => ({
          field: u.field,
          new_value: String(u.new_value),
          source_quote: String(u.source_quote ?? ""),
          confidence: typeof u.confidence === "number" ? u.confidence : 0,
        }))
    : [];
  const cm = raw?.company_match ?? {};
  const lowConf =
    updates.some((u) => u.confidence < 0.8) || cm.company_id == null;
  return {
    email_id: raw?.email_id ?? email.id,
    company_match: {
      name_raw: String(cm.name_raw ?? ""),
      company_id: cm.company_id ?? null,
      confidence: typeof cm.confidence === "number" ? cm.confidence : 0,
    },
    classification: raw?.classification ?? "no_action",
    summary_ja: String(raw?.summary_ja ?? ""),
    updates,
    needs_human_review: Boolean(raw?.needs_human_review) || lowConf,
  };
}

export async function extractEmail(
  email: EmailInput,
  companyList: CompanyRef[],
  today: string,
): Promise<ExtractionResult> {
  const system = buildSystemPrompt(companyList, today);
  const messages = [
    { role: "system", content: system },
    { role: "user", content: userMessage(email) },
  ];

  let content = "";
  try {
    content = await chat(messages, false);
    return normalize(parseJsonLoose(content), email);
  } catch (err) {
    // One repair retry with the parse error fed back in.
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.startsWith("LLM HTTP")) throw err; // network/upstream, not a parse issue
    const repair = [
      ...messages,
      { role: "assistant", content },
      {
        role: "user",
        content: `直前の出力はJSONとして不正でした: ${errMsg}。修正して、\`\`\`json フェンス内に単一のJSONオブジェクトのみ再出力してください。`,
      },
    ];
    const retry = await chat(repair, false);
    return normalize(parseJsonLoose(retry), email);
  }
}

// --- CLI: iterate against data/emails/ ---------------------------------------
// Usage: bun run server/extract.ts   (prints extraction for all seed emails)
if (import.meta.main) {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const ROOT = join(import.meta.dir, "..");
  const today = process.env.TODAY ?? "2026-07-17";

  const companies = JSON.parse(
    readFileSync(join(ROOT, "data", "companies.json"), "utf-8"),
  ) as CompanyRef[];
  const companyList = companies.map((c) => ({
    id: c.id,
    company_name: (c as any).company_name,
    kana: (c as any).kana,
  }));

  function parseEmailFile(path: string): EmailInput {
    const text = readFileSync(path, "utf-8");
    const m = text.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
    const fm: Record<string, string> = {};
    if (m) {
      for (const line of m[1].split("\n")) {
        const kv = line.match(/^(\w+):\s*(.*)$/);
        if (kv) fm[kv[1]] = kv[2].trim();
      }
    }
    return {
      id: fm.id ?? path,
      received_at: fm.received_at ?? "",
      from_addr: fm.from ?? fm.from_addr ?? "",
      subject: fm.subject ?? "",
      body: (m ? m[2] : text).trim(),
    };
  }

  const dir = join(ROOT, "data", "emails");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const f of files) {
    const email = parseEmailFile(join(dir, f));
    process.stdout.write(`\n########## ${f} (${email.id}) ##########\n`);
    await sleep(500); // be gentle on the ai& upstream between heavy calls
    try {
      const r = await extractEmail(email, companyList, today);
      const quoteOk = r.updates.map((u) =>
        email.body.includes(u.source_quote) ? "✓" : "✗(no-exact)",
      );
      console.log(
        JSON.stringify(
          {
            match: `${r.company_match.company_id} (${r.company_match.confidence})`,
            classification: r.classification,
            summary_ja: r.summary_ja,
            updates: r.updates.map((u, i) => ({
              field: u.field,
              new_value: u.new_value,
              confidence: u.confidence,
              quote_exact: quoteOk[i],
            })),
            needs_human_review: r.needs_human_review,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      console.error("ERROR:", e instanceof Error ? e.message : e);
    }
  }
}
