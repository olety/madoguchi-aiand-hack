import { useEffect, useState } from "react";
import { api } from "../api";
import type { IngestResult, SampleEmail } from "../types";
import { FIELD_LABEL } from "../ui";

export function IngestPanel({ onIngested }: { onIngested: (r: IngestResult[]) => void }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<SampleEmail[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);

  useEffect(() => {
    if (open && emails.length === 0) api.sampleEmails().then(setEmails);
  }, [open]);

  async function run() {
    setRunning(true);
    setResults([]);
    // Ingest one at a time so rows appear as each completes.
    const acc: IngestResult[] = [];
    for (const e of emails) {
      try {
        const { results } = await api.ingest([
          {
            id: e.id,
            received_at: e.received_at,
            from_addr: e.from_addr,
            subject: e.subject,
            body: e.body,
          },
        ]);
        acc.push(...results);
        setResults([...acc]);
        onIngested(results);
      } catch (err) {
        acc.push({
          email_id: e.id,
          company_id: null,
          company_name: e.subject,
          error: err instanceof Error ? err.message : String(err),
        });
        setResults([...acc]);
      }
    }
    setRunning(false);
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-slate-600"
      >
        <span>📥 メール取り込み（デモ）</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              data/emails/ の未処理メール {emails.length} 件
            </span>
            <button
              disabled={running || emails.length === 0}
              onClick={run}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {running ? "取り込み中…" : "取り込み実行"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ul className="space-y-2">
              {emails.map((e) => {
                const done = results.find((r) => r.email_id === e.id);
                return (
                  <li
                    key={e.id}
                    className={`rounded-lg border px-3 py-2 text-xs transition ${
                      done
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-700">{e.subject}</div>
                    <div className="text-slate-400">{e.from_addr}</div>
                  </li>
                );
              })}
            </ul>

            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r.email_id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  {r.error ? (
                    <span className="text-red-600">エラー: {r.error}</span>
                  ) : (
                    <>
                      <div className="font-medium text-slate-700">
                        {r.company_name}{" "}
                        <span className="text-slate-400">
                          （{classLabel(r.classification)}）
                        </span>
                      </div>
                      {r.summary_ja && (
                        <div className="text-slate-500">{r.summary_ja}</div>
                      )}
                      {(r.applied ?? []).map((a, i) => (
                        <div key={i} className="text-emerald-700">
                          ✓ {FIELD_LABEL[a.field] ?? a.field}: {a.old || "—"} →{" "}
                          {a.new}
                        </div>
                      ))}
                      {(r.review ?? []).map((rv, i) => (
                        <div key={i} className="text-amber-600">
                          ⚠ 要確認 {FIELD_LABEL[rv.field] ?? rv.field}: {rv.new}（
                          {(rv.confidence * 100).toFixed(0)}%）
                        </div>
                      ))}
                      {(r.applied ?? []).length === 0 &&
                        (r.review ?? []).length === 0 && (
                          <div className="text-slate-400">変更なし</div>
                        )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function classLabel(c?: string): string {
  return (
    {
      payment: "入金",
      renewal: "更新",
      invoice_request: "請求依頼",
      cancellation: "解約",
      other: "その他",
      no_action: "対応不要",
    }[c ?? ""] ?? c ?? ""
  );
}
