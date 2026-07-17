import { useEffect, useState } from "react";
import { api } from "../api";
import type { Company, EmailRow, EventRow } from "../types";
import { FIELD_LABEL, StatusBadge, findQuote, fmtTs, highlight } from "../ui";

export function ProvenanceDrawer({
  company,
  field,
  onClose,
  onAcked,
}: {
  company: Company;
  field: string;
  onClose: () => void;
  onAcked: () => void;
}) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [email, setEmail] = useState<EmailRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.provenance(company.id, field).then((r) => {
      if (!live) return;
      setEvent(r.event);
      setEmail(r.email);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [company.id, field]);

  const value = (company as any)[field] as string;

  return (
    <Overlay onClose={onClose}>
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div className="text-xs text-slate-400">{company.company_name}</div>
          <div className="font-semibold">{FIELD_LABEL[field] ?? field} の根拠</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </header>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2">
          <StatusBadge value={value} />
          {event?.needs_review === 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              要確認
            </span>
          )}
          {event?.confidence != null && (
            <span className="text-xs text-slate-400">
              確信度 {(event.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {loading && <div className="text-sm text-slate-400">読み込み中…</div>}

        {!loading && !event && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            このステータスにはまだ根拠となるメールがありません。
            （取り込み実行後に表示されます）
          </div>
        )}

        {event && event.old_value != null && (
          <div className="text-sm text-slate-600">
            変更: <span className="font-medium">{event.old_value || "—"}</span> →{" "}
            <span className="font-medium">{event.new_value}</span>
          </div>
        )}

        {email && (
          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3 text-sm">
              <div className="font-medium text-slate-800">{email.subject}</div>
              <div className="mt-1 text-xs text-slate-400">
                {email.from_addr} ・ {fmtTs(email.received_at)}
              </div>
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-slate-700">
              {highlight(email.body, event?.source_quote)}
            </pre>
          </div>
        )}

        {event?.source_quote && email && !findQuote(email.body, event.source_quote) && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            引用文が本文と完全一致しませんでした（AIが言い換えた可能性）。要確認。
          </div>
        )}

        {event?.needs_review === 1 && (
          <button
            onClick={async () => {
              await api.ackEvent(event.id);
              onAcked();
            }}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            確認済みにする
          </button>
        )}
      </div>
    </Overlay>
  );
}

export function Overlay({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute right-0 top-0 flex h-full flex-col bg-white shadow-2xl ${
          wide ? "w-[560px]" : "w-[460px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
