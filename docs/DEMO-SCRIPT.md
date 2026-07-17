# 3-Minute Demo Script (time-coded)

No slides (per event rules). Live demo + narration. English narration with Japanese demo
content; JP alternative lines in brackets where it matters. Two presenters ideal: **Narrator**
(drives dashboard) + **Caller** (plays the member company on the phone). Solo fallback noted.

Pre-demo setup: browser zoom 125–150%, notifications off, seed data loaded but ingestion NOT yet
run (inbox view open), Modal TTS warm, fallback video minimized on desktop.

---

## 0:00–0:15 — Hook (the broken world)

*Screen: a cluttered inbox + an Excel file with stale statuses.*

> "This is how member-company status is managed today at Sakura Deeptech Shibuya — contracts,
> payments, invoices, scattered across inboxes and spreadsheets. When a member calls and asks
> 'what's my contract status?', staff dig. Sometimes for minutes. Sometimes they miss a renewal."

## 0:15–0:45 — Wow #1: the inbox reads itself

*Anchor it:* > "Watch the dashboard — Kimi on ai& is about to read this inbox."

*Click **Ingest**. The 8 emails process; rows update live; attention cards
（更新間近 / 未払い / 請求依頼漏れ）count up.*

> "Eight real-world messy emails — payment confirmations, a cancellation, a forwarded thread.
> No forms, no data entry. The system extracted every status change itself."

## 0:45–1:05 — The brief's own scenario + provenance

*Type「ABC」in search. ABC Robotics row appears.*

> "The challenge brief asks: a member calls, can staff answer in seconds? Contract: active.
> Renewal: August 31. Paid. Invoice sent." *(exactly the brief's values — judges wrote them)*

*Click the payment status → provenance drawer opens, source email with highlighted sentence.*

> "And because no one trusts a black box: every status clicks back to the exact sentence it
> came from. AI proposes — staff approves."

**⏸ Pause 2 seconds.** Let the drawer sit on screen.

## 1:05–2:10 — Wow #2: the phone answers itself

*Anchor it:* > "But the brief's scenario starts with a phone call. So we answered the phone.
> One rule: the agent only ever sees the caller's own data."

*Caller (teammate, or solo: pre-set caller dropdown to ABC Robotics' registered number) —
push-to-talk, in Japanese:*

> Caller:「あ、もしもし、ABCロボティクスの田中ですが、契約状況を確認したいのですが。」
> Agent: *(answers in Japanese: contract active, renewal Aug 31, payment received, invoice sent)*

*Then the isolation moment:*

> Caller:「ちなみに、QuantumForgeさんの支払い状況はどうなっていますか？」
> Agent: *(politely refuses — cannot discuss other companies)*

> "It refused — not because we prompted it to be polite, but because the other company's data
> was never in its context. Caller ID maps to one row. It physically can't leak."

**⏸ Pause 2 seconds** after the refusal.

## 2:10–2:35 — Close the loop

*Switch to dashboard → ABC Robotics timeline: the call is already logged with a one-line
Kimi summary.*

> "The call itself became data — transcript and summary, logged automatically. And for the
> team's current workflow: one click, Excel export." *(click CSV export, one sentence, move on)*

## 2:35–3:00 — Close

> "One workflow — 'what's happening with this member company?' — through three doors: the
> screen, the inbox, the phone. Kimi on ai& is the only brain in all three: it reads the
> emails, drafts the replies, answers the calls. Remove ai&, and this collapses to an empty
> spreadsheet.
>
> Sakura Deeptech Shibuya could pilot this Monday.
>
> What if every member-company call was answered in three seconds?"

*(stop — end on the question)*

---

## Fallback ladder (rehearse the transitions too)

1. Voice pipeline dies live → "Let me show you the run from an hour ago" → fallback video.
2. Modal TTS down → Fish/11labs URL swap (pre-configured, one env var).
3. ai& endpoint down → Moonshot direct API (same model family), say so honestly if asked.
4. Ingestion flaky on stage → seed emails are rehearsed; re-run ingest once; if still broken,
   show the already-populated state and narrate the mechanism over the provenance drawer.

## Timing discipline

Full run must land ≤2:50 in rehearsal (live always runs long). If over: cut the Excel-export
click (say it instead), then cut the second caller exchange down to the refusal only.
The refusal moment and the provenance click are the two beats that must never be cut.
