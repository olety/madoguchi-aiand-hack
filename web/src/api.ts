import type {
  Attention,
  Company,
  CompanyDetail,
  EmailRow,
  EventRow,
  IngestResult,
  Phone,
  SampleEmail,
} from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  companies: (q?: string) =>
    fetch(`/api/companies${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(
      j<Company[]>,
    ),
  company: (id: string) =>
    fetch(`/api/companies/${id}`).then(j<CompanyDetail>),
  attention: () => fetch("/api/attention").then(j<Attention>),
  provenance: (id: string, field: string) =>
    fetch(`/api/companies/${id}/provenance?field=${field}`).then(
      j<{ event: EventRow | null; email: EmailRow | null }>,
    ),
  sampleEmails: () => fetch("/api/sample-emails").then(j<SampleEmail[]>),
  ingest: (emails: Omit<SampleEmail, "file">[]) =>
    fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    }).then(j<{ results: IngestResult[] }>),
  ackEvent: (id: number) =>
    fetch(`/api/events/${id}/ack`, { method: "POST" }).then(j<{ ok: boolean }>),
  phones: () => fetch("/api/phones").then(j<Phone[]>),
  addPhone: (phone: string, company_id: string) =>
    fetch("/api/phones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, company_id }),
    }).then(j<{ ok: boolean }>),
  delPhone: (phone: string) =>
    fetch(`/api/phones/${encodeURIComponent(phone)}`, {
      method: "DELETE",
    }).then(j<{ ok: boolean }>),
};
