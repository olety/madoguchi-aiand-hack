# MADOGUCHI（窓口）

**One window into every member company.** Hackathon entry for the Tokyu Land Enterprise Challenge
(ai& × Moonshot Tokyo, 2026-07-17, Sakura Deeptech Shibuya).

> 窓口 = the service counter / one-stop window. The product is one window into membership,
> contract, payment, and billing status — reachable through three doors: **screen** (dashboard),
> **hands** (AI-drafted email), **ears** (voice agent answering member calls).
>
> Name is a working title — rename freely (`grep -ri madoguchi` to find references).

## The one workflow

*"Can staff quickly check what is happening with each member company?"*

Everything in this repo serves that single workflow. We do not build auth, billing engines,
admin panels, or multi-tenancy.

## Repo layout

```
docs/
  PLAN.md              Master plan: framing, architecture, Friday build timeline, risks
  DEMO-SCRIPT.md       Time-coded 3-minute pitch demo script
  JUDGE-QA.md          Adversarial judge questions + rehearsed answers
  VOICE-PIPELINE.md    Voice architecture, deploy commands, latency budget, fallbacks
  EVENT-CHECKLIST.md   Night-before / check-in / T-30 / pre-demo checklists
prompts/
  dashboard-oneshot.md One-shot prompt to generate the dashboard app (fire at hour 0)
  extraction-prompt.md Email → structured status extraction (the core ai& call)
  voice-agent-prompt.md Voice agent system prompt: isolation rules + JP text shaping
data/
  companies.json       16 seed member companies (edge cases mapped to the brief)
  emails/              8 messy Japanese source emails for the live ingestion demo
  calls.json           Seed call log entry (timeline content)
```

## Strategy in one paragraph

The dashboard itself is a one-promptable commodity — several teams picked this challenge and
will all show near-identical CRUD. Our moats, ranked by how hard they are to replicate in a day:
(1) a **live Japanese voice agent** with per-company caller isolation, using pre-built streaming
TTS/ASR assets; (2) **email→status ingestion with provenance** — every AI-extracted status is
clickable back to the exact source sentence. Kimi K2.7 on **ai& is the only brain** in all three
doors: extraction, drafting, and voice reasoning. Remove ai& and the product collapses to an
empty spreadsheet — that sentence is the pitch.

## Quick start (event day)

1. Fire `prompts/dashboard-oneshot.md` at pi/Kimi. Load `data/companies.json`. Freeze the dashboard.
2. Wire ingestion using `prompts/extraction-prompt.md` against the ai& endpoint.
3. Stand up voice per `docs/VOICE-PIPELINE.md` (mock TTS first, URL-swap to Modal at the end).
4. Rehearse `docs/DEMO-SCRIPT.md` twice. Run `docs/EVENT-CHECKLIST.md` before demo.
