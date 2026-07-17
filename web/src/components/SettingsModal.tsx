import { useEffect, useState } from "react";
import { api } from "../api";
import type { Company, Phone } from "../types";

export function SettingsModal({
  companies,
  onClose,
}: {
  companies: Company[];
  onClose: () => void;
}) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState(companies[0]?.id ?? "");

  const load = () => api.phones().then(setPhones);
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-[560px] rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">登録電話番号（発信者ID照合用）</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="mb-4 max-h-72 overflow-y-auto rounded-lg ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-3 py-2">電話番号</th>
                <th className="px-3 py-2">企業</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {phones.map((p) => (
                <tr key={p.phone} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 tabular-nums">{p.phone}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.company_name ?? p.company_id}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={async () => {
                        await api.delPhone(p.phone);
                        load();
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="03-XXXX-XXXX"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <button
            disabled={!newPhone || !newCompany}
            onClick={async () => {
              await api.addPhone(newPhone.trim(), newCompany);
              setNewPhone("");
              load();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
