import { useEffect, useState } from "react";
import { api } from "../api";
import type { CompanyDetail, EventRow } from "../types";
import { FIELD_LABEL, StatusBadge, fmtDate, fmtTs } from "../ui";
import { Overlay } from "./ProvenanceDrawer";

export function CompanyDrawer({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [c, setC] = useState<CompanyDetail | null>(null);

  useEffect(() => {
    let live = true;
    api.company(companyId).then((d) => live && setC(d));
    return () => {
      live = false;
    };
  }, [companyId]);

  return (
    <Overlay onClose={onClose} wide>
      {!c ? (
        <div className="p-6 text-sm text-slate-400">読み込み中…</div>
      ) : (
        <>
          <header className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <div className="text-xs text-slate-400">{c.kana}</div>
              <div className="text-lg font-semibold">{c.company_name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {c.industry} ・ {c.membership_plan} ・ {c.contact_person}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </header>

          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <section className="grid grid-cols-2 gap-3">
              <Field label="契約状況">
                <StatusBadge value={c.contract_status} />
              </Field>
              <Field label="契約更新日">{fmtDate(c.renewal_date)}</Field>
              <Field label="支払い状況">
                <StatusBadge value={c.payment_status} />
              </Field>
              <Field label="請求依頼状況">
                <StatusBadge value={c.invoice_request_status} />
              </Field>
              <Field label="契約開始日">{fmtDate(c.contract_start)}</Field>
              <Field label="担当者">{c.contact_person}</Field>
            </section>

            {c.notes && (
              <section>
                <SectionTitle>メモ</SectionTitle>
                <p className="text-sm text-slate-600">{c.notes}</p>
              </section>
            )}

            <section>
              <SectionTitle>登録電話番号</SectionTitle>
              {c.phones.length === 0 ? (
                <p className="text-sm text-slate-400">なし</p>
              ) : (
                <ul className="text-sm text-slate-700">
                  {c.phones.map((p) => (
                    <li key={p} className="tabular-nums">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionTitle>タイムライン</SectionTitle>
              <Timeline events={c.events} />
            </section>
          </div>
        </>
      )}
    </Overlay>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </h3>
  );
}

function Timeline({ events }: { events: EventRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (events.length === 0)
    return <p className="text-sm text-slate-400">イベントはまだありません。</p>;
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <div className="mt-1 text-lg leading-none">{iconFor(e.kind)}</div>
          <div className="flex-1">
            <div className="text-xs text-slate-400">{fmtTs(e.ts)}</div>
            <div className="text-sm text-slate-700">{describe(e)}</div>
            {e.kind === "call" && e.transcript && (
              <button
                onClick={() => setOpen(open === e.id ? null : e.id)}
                className="mt-1 text-xs text-blue-600 hover:underline"
              >
                {open === e.id ? "書き起こしを隠す" : "書き起こしを表示"}
              </button>
            )}
            {open === e.id && e.transcript && (
              <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">
                {e.transcript}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function iconFor(kind: EventRow["kind"]): string {
  return kind === "call"
    ? "📞"
    : kind === "email"
      ? "✉️"
      : kind === "status_change"
        ? "🔄"
        : "📝";
}

function describe(e: EventRow): string {
  if (e.kind === "call") return e.summary_ja ?? "通話";
  if (e.kind === "email") return e.summary_ja ?? "メール取り込み";
  if (e.kind === "status_change")
    return `${FIELD_LABEL[e.field ?? ""] ?? e.field}: ${e.old_value || "—"} → ${e.new_value}${
      e.needs_review ? "（要確認）" : ""
    }`;
  if (e.kind === "note") return `メモ: ${e.new_value}`;
  return e.summary_ja ?? "";
}
