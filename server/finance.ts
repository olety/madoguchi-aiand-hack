// NexusArbitrage — Multi-Tier Supply Chain Capital Arbitrage math.
// Pure functions; all rates are decimals (1% => 0.01), days in days.
// Formulas per the NexusArbitrage corporate-finance spec.

const DAYS = 365;

// --- 1. Cash Conversion Cycle (CCC = DIO + DSO - DPO) ------------------------
export const daysInventoryOutstanding = (avgInventory: number, cogs: number) =>
  cogs > 0 ? (avgInventory / cogs) * DAYS : 0;

export const daysSalesOutstanding = (avgAR: number, creditSales: number) =>
  creditSales > 0 ? (avgAR / creditSales) * DAYS : 0;

export const daysPayableOutstanding = (avgAP: number, cogs: number) =>
  cogs > 0 ? (avgAP / cogs) * DAYS : 0;

export const cashConversionCycle = (dio: number, dso: number, dpo: number) =>
  dio + dso - dpo;

// --- 2. Arbitrage Pricing Window --------------------------------------------
// Annualized equivalent discount rate: r_d = (d / (1 - d)) * (365 / ΔT)
export function annualizedDiscountRate(d: number, deltaTDays: number): number {
  if (deltaTDays <= 0 || d <= 0 || d >= 1) return 0;
  return (d / (1 - d)) * (DAYS / deltaTDays);
}

// Window: r_b < r_d < r_s  (buyer earns above hurdle; supplier funds below bank)
export function evaluateArbitrageWindow(
  buyerRate: number, // r_b
  supplierRate: number, // r_s
  rd: number,
) {
  return {
    buyer_rate: buyerRate,
    supplier_rate: supplierRate,
    annualized_discount_rate: rd,
    in_window: rd > buyerRate && rd < supplierRate,
    buyer_yield_spread: rd - buyerRate, // buyer earns this over hurdle
    supplier_interest_saving: supplierRate - rd, // supplier funds cheaper than bank
  };
}

// --- 3. Valuation & Stock-price impact --------------------------------------
// Step A: 100% of procurement savings drops to EBITDA: ΔEBITDA = COGS * d
export const ebitdaExpansion = (cogs: number, d: number) => cogs * d;

// Step B: EV multiplier effect: ΔEV = ΔEBITDA * (EV/EBITDA multiple)
export const enterpriseValueUplift = (
  deltaEbitda: number,
  evEbitdaMultiple: number,
) => deltaEbitda * evEbitdaMultiple;

// Step C: per-share impact: ΔEV / shares outstanding
export const stockPriceImpact = (deltaEv: number, sharesOutstanding: number) =>
  sharesOutstanding > 0 ? deltaEv / sharesOutstanding : 0;

// --- Top-level engine --------------------------------------------------------
export type ArbitrageInput = {
  buyer_rate?: number; // r_b, default 0.01
  supplier_rate?: number; // r_s, default 0.09
  discount?: number; // d, default 0.0068
  days_early?: number; // ΔT, default 50
  cogs?: number; // for ΔEBITDA / valuation
  ev_ebitda_multiple?: number; // M
  shares_outstanding?: number; // optional -> per-share impact
  // Optional raw balance-sheet inputs to compute CCC before/after:
  avg_inventory?: number;
  avg_receivables?: number;
  avg_payables?: number;
  credit_sales?: number;
};

const round = (n: number, p = 6) => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};

export function computeArbitrage(input: ArbitrageInput) {
  const rb = input.buyer_rate ?? 0.01;
  const rs = input.supplier_rate ?? 0.09;
  const d = input.discount ?? 0.0068;
  const dt = input.days_early ?? 50;

  const rd = annualizedDiscountRate(d, dt);
  const window = evaluateArbitrageWindow(rb, rs, rd);

  const out: Record<string, unknown> = {
    inputs: { buyer_rate: rb, supplier_rate: rs, discount: d, days_early: dt },
    pricing_window: {
      ...window,
      annualized_discount_rate: round(rd),
      buyer_yield_spread: round(window.buyer_yield_spread),
      supplier_interest_saving: round(window.supplier_interest_saving),
      // human-readable percents
      annualized_discount_rate_pct: round(rd * 100, 3),
      buyer_yield_spread_pct: round(window.buyer_yield_spread * 100, 3),
      supplier_interest_saving_pct: round(window.supplier_interest_saving * 100, 3),
    },
  };

  // Cash Conversion Cycle (if balance-sheet inputs provided)
  if (
    input.cogs != null &&
    (input.avg_inventory != null ||
      input.avg_receivables != null ||
      input.avg_payables != null)
  ) {
    const dio = daysInventoryOutstanding(input.avg_inventory ?? 0, input.cogs);
    const dso = daysSalesOutstanding(
      input.avg_receivables ?? 0,
      input.credit_sales ?? input.cogs,
    );
    const dpo = daysPayableOutstanding(input.avg_payables ?? 0, input.cogs);
    const ccc = cashConversionCycle(dio, dso, dpo);
    // Supplier paid ΔT days early -> DSO drops by ΔT -> CCC drops by ΔT.
    out.cash_conversion_cycle = {
      dio: round(dio, 2),
      dso: round(dso, 2),
      dpo: round(dpo, 2),
      ccc_days: round(ccc, 2),
      supplier_ccc_days_after_early_payment: round(ccc - dt, 2),
      working_capital_freed_days: dt,
    };
  }

  // Valuation impact (if COGS provided)
  if (input.cogs != null) {
    const dEbitda = ebitdaExpansion(input.cogs, d);
    const valuation: Record<string, number> = {
      cogs: input.cogs,
      delta_ebitda: round(dEbitda, 2),
    };
    if (input.ev_ebitda_multiple != null) {
      const dEv = enterpriseValueUplift(dEbitda, input.ev_ebitda_multiple);
      valuation.ev_ebitda_multiple = input.ev_ebitda_multiple;
      valuation.delta_enterprise_value = round(dEv, 2);
      if (input.shares_outstanding != null && input.shares_outstanding > 0) {
        valuation.delta_share_price = round(
          stockPriceImpact(dEv, input.shares_outstanding),
          4,
        );
        valuation.shares_outstanding = input.shares_outstanding;
      }
    }
    out.valuation_impact = valuation;
  }

  out.verdict = window.in_window
    ? `Arbitrage viable: r_d ${round(rd * 100, 2)}% sits inside (${rb * 100}%, ${rs * 100}%). Buyer earns +${round(window.buyer_yield_spread * 100, 2)}%, supplier saves ${round(window.supplier_interest_saving * 100, 2)}%.`
    : `No arbitrage: r_d ${round(rd * 100, 2)}% is outside the (${rb * 100}%, ${rs * 100}%) cost-of-capital window.`;

  return out;
}
