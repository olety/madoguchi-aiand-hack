import type { ReactNode } from "react";

type Tone = "green" | "amber" | "red" | "neutral";

const TONE: Record<string, Tone> = {
  // green
  有効: "green",
  支払い済み: "green",
  送付済み: "green",
  // amber
  更新手続き中: "amber",
  入金待ち: "amber",
  作成中: "amber",
  新規申込中: "amber",
  // red
  未払い: "red",
  督促中: "red",
  未送付: "red",
  解約予定: "red",
  // neutral
  不要: "neutral",
};

const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function toneOf(value: string): Tone {
  return TONE[value] ?? "neutral";
}

export function StatusBadge({
  value,
  onClick,
}: {
  value: string;
  onClick?: () => void;
}) {
  const cls = TONE_CLASS[toneOf(value)];
  const clickable = Boolean(onClick);
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls} ${
        clickable ? "cursor-pointer hover:ring-2 transition" : ""
      }`}
    >
      {value}
    </span>
  );
}

/**
 * Locate `quote` inside `body`, tolerating whitespace differences (source emails
 * wrap sentences across lines). Returns [start, end) offsets into `body` or null.
 */
export function findQuote(
  body: string,
  quote?: string | null,
): [number, number] | null {
  if (!quote) return null;
  const trimmed = quote.trim();
  if (!trimmed) return null;
  const exact = body.indexOf(trimmed);
  if (exact >= 0) return [exact, exact + trimmed.length];
  // whitespace-insensitive: build a regex where any run of whitespace matches \s+
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const m = new RegExp(escaped).exec(body);
  return m ? [m.index, m.index + m[0].length] : null;
}

/** Highlight the first occurrence of `quote` inside `body` (whitespace-tolerant). */
export function highlight(body: string, quote?: string | null): ReactNode {
  const span = findQuote(body, quote);
  if (!span) return body;
  const [i, end] = span;
  return (
    <>
      {body.slice(0, i)}
      <mark>{body.slice(i, end)}</mark>
      {body.slice(end)}
    </>
  );
}

export function fmtDate(s?: string | null): string {
  if (!s) return "";
  return s.slice(0, 10);
}

export function fmtTs(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace("T", " ");
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export const FIELD_LABEL: Record<string, string> = {
  payment_status: "支払い状況",
  invoice_request_status: "請求依頼状況",
  contract_status: "契約状況",
  renewal_date: "契約更新日",
  note: "メモ",
};
