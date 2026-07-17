# MADOGUCHI — Master Plan

Event: ai& × Moonshot Tokyo hackathon, **Friday 2026-07-17**.
Challenge: Tokyu Land Enterprise Challenge (Sakura Deeptech Shibuya member-company status dashboard).
Model: Kimi K2.7 on ai& inference (LLM only — no voice models on ai&).

---

## 1. Framing: one workflow, three doors

The brief demands the *smallest MVP that solves one workflow*: "staff instantly knows the status
of any member company." We honor that scope discipline — and serve the workflow through the three
channels staff already use:

| Door | Channel | What it does | ai& role |
|---|---|---|---|
| **Eyes** | Dashboard | Search + status view + attention cards + provenance | Extraction populated it |
| **Hands** | Email | AI-drafted renewal reminders, human clicks Send | Kimi drafts |
| **Ears** | Phone | Voice agent answers the caller's own status questions | Kimi reasons + answers |

Same database. Same brain (Kimi on ai&). Three doors. **Never say "level 1/2/3" on stage** —
that framing invites the scope objection. It is one system with three access channels.

What we deliberately do NOT build: login/auth, real Slack API (mocked), real email sending
(draft + fake send), mobile responsiveness, multi-tenancy, role permissions.

## 2. Why this wins (judging-axis map)

| Axis | Our answer |
|---|---|
| Innovation | Ingestion-from-channels + caller-isolated voice answering; not CRUD-with-chatbot |
| Technical Execution | Live JP voice pipeline (ASR→Kimi→streaming TTS) + structured extraction w/ provenance |
| Impact | Attacks the sponsor's exact stated pain (info scattered across files & channels); credible pilot at Sakura Deeptech Shibuya |
| Presentation | Reenacts the brief's own phone-call scenario, live |
| Use of ai& | Kimi is the *only* brain: extraction, drafting, voice reasoning. Remove ai& → empty spreadsheet |

Competitive context: multiple teams chose this challenge; the dashboard is one-promptable.
Judges will be numb to CRUD by the third team. Our two moats (voice w/ isolation, provenance
ingestion) are the parts a competitor cannot one-shot in a day.

## 3. Architecture

```
                       ┌────────────────────────────┐
  messy emails ──────► │  POST /api/ingest          │
  (Slack: mocked)      │  Kimi @ ai& — extraction   │──► SQLite (bun:sqlite)
                       │  returns source_quote      │      │
                       └────────────────────────────┘      │
                                                           ▼
  staff browser ◄──── React dashboard (search, attention cards,
                      provenance drawer, timeline, settings, CSV export)
                                                           ▲
  caller (push-to-talk) ─► ASR (local MLX transcribe)      │
        ▲                    │ text                        │
        │ 24kHz PCM          ▼                             │
   streaming TTS ◄─ seam ─ Kimi @ ai& ◄── ONLY the caller's company row
   (Modal Qwen3-TTS,        │                              │
    Fish/11labs fallback)   └── call transcript + summary ─┘
```

- **Server**: Bun + Hono, serves API + static build. SQLite via `bun:sqlite`.
- **Isolation mechanism** (the Q&A answer): caller ID → lookup in registered-phones table →
  only that company's row is injected into Kimi's context. The model *physically cannot see*
  other rows. Refusal instructions are backup, not the mechanism.
- **Provenance mechanism**: extraction returns `source_quote` + `source_email_id` per field
  update; dashboard stores them; clicking any status opens a drawer with the source email and
  the quote highlighted. "AI proposes, staff approves."
- Voice details, deploy commands, latency budget: `docs/VOICE-PIPELINE.md`.

## 4. Friday build timeline (relative hours, with decision gates)

| Slot | Work | Gate |
|---|---|---|
| H0–H1 | Fire `prompts/dashboard-oneshot.md`, load seed data, **freeze the dashboard** | Dashboard renders + search works → do not touch it again |
| H1–H2.5 | Ingestion: `/api/ingest` + extraction prompt against ai&; provenance drawer | 6/8 seed emails extract correctly → move on |
| H2.5–H5 | Voice: mock seam first, then transcribe + Kimi + Modal TTS; refusal case | **Gate at H4.5**: if voice not conversing, cut email door entirely, keep voice minimal (single scripted exchange + refusal) |
| H5–H6 | Email door: renewal-reminder draft + confirm-to-send button (~1h cap, first thing cut) | |
| H6+ | Polish demo path only, record fallback video, rehearse ×2 | |

Ordering rationale: voice before email — voice is pre-built (highest payoff per hour), email is
one-promptable (weakest moat, cut first).

If solo (no teammates): cut the timeline view first (provenance drawer alone carries the trust
story), hardcode the demo caller identity.

## 5. Pre-Friday prep (done in this repo)

- [x] Seed dataset: 16 companies with edge cases mapped 1:1 to the brief's "why this matters"
      bullets (3× renewal ≤30 days, 3× unpaid, 2× invoice-request missing, 1× cancellation,
      1× new application, ABC Robotics = the brief's scenario verbatim).
- [x] 8 messy JP source emails, each mapping to a specific extractable fact (incl. one no-op
      noise email and one ambiguous forwarded thread — shows the schema handles noise).
- [x] Extraction prompt + JSON schema (`prompts/extraction-prompt.md`).
- [x] Voice agent system prompt w/ isolation + JP text-shaping (`prompts/voice-agent-prompt.md`).
- [x] Dashboard one-shot prompt (`prompts/dashboard-oneshot.md`).
- [ ] Iterate extraction prompt at home against Moonshot direct API (kimi-k2.7-code smoke rig);
      swap baseUrl to ai& at check-in.
- [ ] Pre-download `transcribe` MLX model (~2.3 GB) at home — NOT on venue wifi.
- [ ] `modal app list` — confirm eiri-voice deployability; fetch 11labs/fish keys via skate.
- [ ] Record fallback video of the voice demo Thursday night if pipeline already runs.

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Live voice demo fails (audio/wifi) | med | Fallback video on desktop; wired mic; hotspot backup; mock TTS as last resort (narrate "swapped to mock backend") |
| Kimi TTFT on ai& is slow | unknown | Measure at check-in; short system prompt; stream TTS per sentence-ender; open replies ≤15 chars |
| ai& has no JSON mode / tool calls | med | Prompt-based JSON extraction fallback already written into the prompt (fenced-JSON output + parser) |
| Scope objection from judges | high | "One workflow, three doors" stated up front; never "levels" |
| Another team also does voice | low-med | Scan the room early; if so, our edge = reliability + isolation story; rehearse refusal demo extra |
| Extraction errors on stage | med | Demo uses the 8 rehearsed seed emails; provenance drawer turns any error into a feature ("staff verifies in one glance") |

## 7. The pitch spine (memorize)

1. Pain: status lives scattered across inboxes and spreadsheets — answering one phone call
   means digging.
2. Watch Kimi read the inbox → dashboard populates itself. *(wow #1)*
3. Search「ABC」→ the brief's exact scenario answered in 3 seconds. Click a status → the
   source sentence. AI proposes, staff approves.
4. The phone rings. The agent answers — and refuses to leak another company's data. *(wow #2)*
5. The call itself becomes data: transcript + summary land in the timeline.
6. Kimi on ai& is the only brain in all three doors. Remove it → empty spreadsheet.
7. Close: "What if every member-company call was answered in three seconds?"
