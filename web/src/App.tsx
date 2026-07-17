import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Attention, Company, IngestResult } from "./types";
import { AttentionCards } from "./components/AttentionCards";
import { CompanyTable } from "./components/CompanyTable";
import { ProvenanceDrawer } from "./components/ProvenanceDrawer";
import { CompanyDrawer } from "./components/CompanyDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { IngestPanel } from "./components/IngestPanel";

type AttnKey = "renewal_soon" | "unpaid" | "invoice_missing";

export default function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [attention, setAttention] = useState<Attention | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttnKey | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [prov, setProv] = useState<{ company: Company; field: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [cs, at] = await Promise.all([api.companies(query), api.attention()]);
    setCompanies(cs);
    setAttention(at);
  }, [query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Which companies to show: search results, optionally narrowed by an attention filter.
  const filtered = filter
    ? companies.filter((c) => c.alerts.includes(filter))
    : companies;

  const flashTimer = useRef<number | null>(null);
  const onIngested = useCallback(
    (results: IngestResult[]) => {
      const ids = new Set(
        results.map((r) => r.company_id).filter((x): x is string => !!x),
      );
      setFlashIds(ids);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashIds(new Set()), 1700);
      refresh();
    },
    [refresh],
  );

  async function onBadgeClick(c: Company, field: string) {
    // Open provenance only if a source event exists (otherwise no-op, per spec).
    const { event } = await api.provenance(c.id, field);
    if (event) setProv({ company: c, field });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            MADOGUCHI <span className="text-slate-400">— 会員企業ステータス</span>
          </h1>
          <div className="flex gap-2">
            <a
              href="/api/export.csv"
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
            >
              CSVエクスポート
            </a>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
              title="設定"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Hero search */}
        <div className="mt-6 flex justify-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="企業名・カナで検索…"
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-4 text-lg shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </header>

      <div className="space-y-6">
        <AttentionCards
          attention={attention}
          active={filter}
          onToggle={(k) => setFilter(filter === k ? null : k)}
        />

        {filter && (
          <div className="text-sm text-slate-500">
            「
            {{ renewal_soon: "更新間近", unpaid: "未払い", invoice_missing: "請求依頼漏れ" }[
              filter
            ]}
            」で絞り込み中 ・ {filtered.length} 社
            <button
              onClick={() => setFilter(null)}
              className="ml-2 text-blue-600 hover:underline"
            >
              解除
            </button>
          </div>
        )}

        <CompanyTable
          companies={filtered}
          flashIds={flashIds}
          onRowClick={(c) => setDetailId(c.id)}
          onBadgeClick={onBadgeClick}
        />

        <IngestPanel onIngested={onIngested} />
      </div>

      {/* Drawers / modals */}
      {prov && (
        <ProvenanceDrawer
          company={prov.company}
          field={prov.field}
          onClose={() => setProv(null)}
          onAcked={() => {
            setProv(null);
            refresh();
          }}
        />
      )}
      {detailId && (
        <CompanyDrawer companyId={detailId} onClose={() => setDetailId(null)} />
      )}
      {settingsOpen && (
        <SettingsModal
          companies={companies}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
