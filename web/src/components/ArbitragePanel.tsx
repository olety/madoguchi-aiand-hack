import { useEffect, useState } from "react";
import { api } from "../api";
import type { ArbitrageResult } from "../types";

// UI holds human-friendly units (percents, plain numbers); we convert to the
// API's decimals on submit.
type Form = {
  buyer_rate_pct: string;
  supplier_rate_pct: string;
  discount_pct: string;
  days_early: string;
  cogs: string;
  ev_ebitda_multiple: string;
  shares_outstanding: string;
  avg_inventory: string;
  avg_receivables: string;
  avg_payables: string;
  credit_sales: string;
};

const DEFAULTS: Form = {
  buyer_rate_pct: "1",
  supplier_rate_pct: "9",
  discount_pct: "0.68",
  days_early: "50",
  cogs: "5000000000",
  ev_ebitda_multiple: "12",
  shares_outstanding: "100000000",
  avg_inventory: "800000000",
  avg_receivables: "1200000000",
  avg_payables: "600000000",
  credit_sales: "8000000000",
};

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const yen = (n?: number) =>
  n == null ? "—" : "¥" + Math.round(n).toLocaleString("ja-JP");
const pct = (n?: number) => (n == null ? "—" : n.toFixed(2) + "%");

export function ArbitragePanel() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(DEFAULTS);
  const [res, setRes] = useState<ArbitrageResult | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Form>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function compute() {
    setBusy(true);
    try {
      const input: Record<string, number> = {};
      const rb = num(f.buyer_rate_pct);
      const rs = num(f.supplier_rate_pct);
      const d = num(f.discount_pct);
      if (rb != null) input.buyer_rate = rb / 100;
      if (rs != null) input.supplier_rate = rs / 100;
      if (d != null) input.discount = d / 100;
      for (const k of [
        "days_early",
        "cogs",
        "ev_ebitda_multiple",
        "shares_outstanding",
        "avg_inventory",
        "avg_receivables",
        "avg_payables",
        "credit_sales",
      ] as const) {
        const v = num(f[k]);
        if (v != null) input[k] = v;
      }
      setRes(await api.arbitrage(input));
    } finally {
      setBusy(false);
    }
  }

  // Auto-compute once when first opened.
  useEffect(() => {
    if (open && !res) compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const w = res?.pricing_window;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-slate-600"
      >
        <span>💹 ダイナミック割引アービトラージ（NexusArbitrage）</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-6 border-t border-slate-100 px-5 py-4">
          {/* Inputs */}
          <div className="space-y-3">
            <Group title="コスト・オブ・キャピタル / 割引">
              <Field label="買い手 資本コスト rᵦ (%)">
                <Inp v={f.buyer_rate_pct} on={(v) => set("buyer_rate_pct", v)} />
              </Field>
              <Field label="サプライヤー 資本コスト rₛ (%)">
                <Inp v={f.supplier_rate_pct} on={(v) => set("supplier_rate_pct", v)} />
              </Field>
              <Field label="SKU割引率 d (%)">
                <Inp v={f.discount_pct} on={(v) => set("discount_pct", v)} />
              </Field>
              <Field label="早期支払日数 ΔT（日）">
                <Inp v={f.days_early} on={(v) => set("days_early", v)} />
              </Field>
            </Group>
            <Group title="バリュエーション">
              <Field label="COGS 売上原価 (¥)">
                <Inp v={f.cogs} on={(v) => set("cogs", v)} />
              </Field>
              <Field label="EV/EBITDA 倍率">
                <Inp v={f.ev_ebitda_multiple} on={(v) => set("ev_ebitda_multiple", v)} />
              </Field>
              <Field label="発行済株式数">
                <Inp v={f.shares_outstanding} on={(v) => set("shares_outstanding", v)} />
              </Field>
            </Group>
            <Group title="運転資本（CCC・任意）">
              <Field label="平均在庫 (¥)">
                <Inp v={f.avg_inventory} on={(v) => set("avg_inventory", v)} />
              </Field>
              <Field label="平均売掛金 (¥)">
                <Inp v={f.avg_receivables} on={(v) => set("avg_receivables", v)} />
              </Field>
              <Field label="平均買掛金 (¥)">
                <Inp v={f.avg_payables} on={(v) => set("avg_payables", v)} />
              </Field>
              <Field label="信用売上高 (¥)">
                <Inp v={f.credit_sales} on={(v) => set("credit_sales", v)} />
              </Field>
            </Group>
            <button
              onClick={compute}
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {busy ? "計算中…" : "計算する"}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!res ? (
              <div className="text-sm text-slate-400">
                入力して「計算する」を押してください。
              </div>
            ) : (
              <>
                <div
                  className={`rounded-xl p-4 ${
                    w?.in_window
                      ? "bg-emerald-50 ring-1 ring-emerald-200"
                      : "bg-red-50 ring-1 ring-red-200"
                  }`}
                >
                  <div className="text-xs text-slate-500">年率換算割引率 r_d</div>
                  <div
                    className={`text-3xl font-bold tabular-nums ${
                      w?.in_window ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {pct(w?.annualized_discount_rate_pct)}
                  </div>
                  <WindowBar
                    rb={(w?.buyer_rate ?? 0) * 100}
                    rd={w?.annualized_discount_rate_pct ?? 0}
                    rs={(w?.supplier_rate ?? 0) * 100}
                    ok={!!w?.in_window}
                  />
                  <div className="mt-2 text-xs text-slate-600">{res.verdict}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Stat label="買い手 利回りスプレッド" v={pct(w?.buyer_yield_spread_pct)} />
                  <Stat label="サプライヤー 金利削減" v={pct(w?.supplier_interest_saving_pct)} />
                </div>

                {res.valuation_impact && (
                  <div className="rounded-xl ring-1 ring-slate-200">
                    <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                      バリュエーション・インパクト
                    </div>
                    <dl className="divide-y divide-slate-50 text-sm">
                      <Row k="ΔEBITDA" v={yen(res.valuation_impact.delta_ebitda)} />
                      <Row k="ΔEnterprise Value" v={yen(res.valuation_impact.delta_enterprise_value)} />
                      <Row
                        k="1株あたり株価インパクト"
                        v={
                          res.valuation_impact.delta_share_price != null
                            ? "¥" + res.valuation_impact.delta_share_price.toFixed(2)
                            : "—"
                        }
                        strong
                      />
                    </dl>
                  </div>
                )}

                {res.cash_conversion_cycle && (
                  <div className="rounded-xl ring-1 ring-slate-200">
                    <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                      キャッシュ・コンバージョン・サイクル
                    </div>
                    <dl className="divide-y divide-slate-50 text-sm">
                      <Row k="DIO / DSO / DPO" v={`${res.cash_conversion_cycle.dio} / ${res.cash_conversion_cycle.dso} / ${res.cash_conversion_cycle.dpo} 日`} />
                      <Row k="CCC（現状）" v={`${res.cash_conversion_cycle.ccc_days} 日`} />
                      <Row
                        k={`早期支払後（−${res.cash_conversion_cycle.working_capital_freed_days}日）`}
                        v={`${res.cash_conversion_cycle.supplier_ccc_days_after_early_payment} 日`}
                        strong
                      />
                    </dl>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WindowBar({ rb, rd, rs, ok }: { rb: number; rd: number; rs: number; ok: boolean }) {
  // position rd within [rb, rs] (clamped) for a simple visual
  const span = Math.max(rs - rb, 0.0001);
  const posClamped = Math.min(Math.max((rd - rb) / span, 0), 1) * 100;
  const posRaw = ((rd - rb) / span) * 100;
  const inside = posRaw >= 0 && posRaw <= 100;
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-blue-200 via-emerald-200 to-amber-200">
        <div
          className={`absolute -top-1 h-4 w-1 rounded ${inside && ok ? "bg-emerald-600" : "bg-red-600"}`}
          style={{ left: `calc(${posClamped}% - 2px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
        <span>rᵦ {rb.toFixed(1)}%</span>
        <span>rₛ {rs.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-400">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="w-36">{children}</span>
    </label>
  );
}

function Inp({ v, on }: { v: string; on: (v: string) => void }) {
  return (
    <input
      value={v}
      onChange={(e) => on(e.target.value)}
      inputMode="decimal"
      className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-xs tabular-nums outline-none focus:border-slate-400"
    />
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-emerald-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-bold text-emerald-700 tabular-nums">{v}</div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold text-slate-900" : "text-slate-700"}`}>
        {v}
      </dd>
    </div>
  );
}
