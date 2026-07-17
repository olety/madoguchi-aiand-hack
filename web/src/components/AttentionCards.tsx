import type { Attention } from "../types";

type Key = "renewal_soon" | "unpaid" | "invoice_missing";

const CARDS: { key: Key; label: string }[] = [
  { key: "renewal_soon", label: "更新間近" },
  { key: "unpaid", label: "未払い" },
  { key: "invoice_missing", label: "請求依頼漏れ" },
];

export function AttentionCards({
  attention,
  active,
  onToggle,
}: {
  attention: Attention | null;
  active: Key | null;
  onToggle: (k: Key) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {CARDS.map(({ key, label }) => {
        const count = attention?.[key].count ?? 0;
        const hot = count > 0;
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`text-left rounded-2xl bg-white p-5 shadow-sm ring-1 transition
              ${isActive ? "ring-2 ring-slate-900" : "ring-slate-200 hover:ring-slate-300"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{label}</span>
              {hot && (
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    key === "renewal_soon" ? "bg-amber-500" : "bg-red-500"
                  }`}
                />
              )}
            </div>
            <div
              className={`mt-2 text-4xl font-bold tabular-nums ${
                hot
                  ? key === "renewal_soon"
                    ? "text-amber-600"
                    : "text-red-600"
                  : "text-slate-300"
              }`}
            >
              {count}
              <span className="ml-1 text-base font-normal text-slate-400">社</span>
            </div>
            {isActive && (
              <div className="mt-1 text-xs text-slate-400">
                クリックで絞り込み解除
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
