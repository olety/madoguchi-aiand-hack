import type { Company } from "../types";
import { StatusBadge, fmtDate } from "../ui";

export function CompanyTable({
  companies,
  flashIds,
  onRowClick,
  onBadgeClick,
}: {
  companies: Company[];
  flashIds: Set<string>;
  onRowClick: (c: Company) => void;
  onBadgeClick: (c: Company, field: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
            <th className="px-4 py-3">企業名</th>
            <th className="px-4 py-3">契約状況</th>
            <th className="px-4 py-3">更新日</th>
            <th className="px-4 py-3">支払い状況</th>
            <th className="px-4 py-3">請求依頼状況</th>
            <th className="px-4 py-3">プラン</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const dtr = c.days_to_renewal;
            const renewalSoon =
              c.contract_status === "有効" &&
              dtr !== null &&
              dtr >= 0 &&
              dtr <= 30;
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                  flashIds.has(c.id) ? "row-flash" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">
                    {c.company_name}
                  </div>
                  <div className="text-xs text-slate-400">{c.kana}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    value={c.contract_status}
                    onClick={() => onBadgeClick(c, "contract_status")}
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                      renewalSoon ? "bg-amber-100 text-amber-800" : "text-slate-600"
                    }`}
                  >
                    {fmtDate(c.renewal_date)}
                    {renewalSoon && (
                      <span className="rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">
                        あと{dtr}日
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    value={c.payment_status}
                    onClick={() => onBadgeClick(c, "payment_status")}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    value={c.invoice_request_status}
                    onClick={() => onBadgeClick(c, "invoice_request_status")}
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">{c.membership_plan}</td>
              </tr>
            );
          })}
          {companies.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                該当する企業がありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
