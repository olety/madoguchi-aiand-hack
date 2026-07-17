# Event-Day Checklists

## Thursday night (home, good wifi)

- [ ] `transcribe` MLX model downloaded (~2.3 GB): `transcribe --help` then run once on a test wav
- [ ] `modal app list` — Modal auth alive; note any existing `eiri-voice*` deployment URL
- [ ] Keys fetched and stashed in shell env / skate: `skate get moonshot`, `skate get 11labs`,
      fish key if used (dead keys as of 07-12: fireworks env key — don't rely on it)
- [ ] Extraction prompt iterated against Moonshot direct API on the 8 seed emails — target 8/8,
      accept 6/8 (note which fail and why)
- [ ] Dashboard one-shot prompt test-fired once (any model) to shake out spec ambiguities
- [ ] If voice loop already runs end-to-end: record fallback video now, not Friday
- [ ] Charge everything; pack wired mic/earbuds; phone hotspot tested

## Check-in (at venue, before hacking starts)

- [ ] Get ai& endpoint + model id → fill `~/.pi/agent/models.json` (`ai-and` provider has
      placeholder baseUrl + `$AI_AND_API_KEY`; hot-reloads via /model)
- [ ] Flip `~/.pi/agent/settings.json` defaultProvider/defaultModel → ai-and / kimi-k2.7
      (subagent children inherit)
- [ ] **Measure Kimi TTFT on ai&** (biggest unknown): time-to-first-token on a short prompt ×5
- [ ] Test JSON mode / structured output on ai& — if absent, extraction prompt's fenced-JSON
      fallback is already written, just flip the flag
- [ ] Venue wifi speed test; decide wifi vs hotspot for Modal/ai& traffic
- [ ] Scan the room: is any other team attempting voice? (if yes → our edge is reliability +
      isolation; rehearse refusal beat extra)

## T-30 min before demo slot

- [ ] `modal deploy server/modal_app.py` from eiri-voice root (or reuse warm app)
- [ ] `bench-ttfb --url wss://… --n 5 --feed llm` — confirm TTFB sane
- [ ] Keep worker warm: `min_containers=1` or ping every ~5 min until demo done
- [ ] Full demo run-through once, timed (must land ≤2:50)

## Pre-demo (last 5 min)

- [ ] Browser zoom 125–150 %, large cursor, notifications OFF (macOS Focus mode)
- [ ] Seed data loaded; ingestion NOT yet run; inbox view open (demo starts on the broken world)
- [ ] Caller identity preset to ABC Robotics' registered number
- [ ] Fallback video minimized on desktop, volume checked
- [ ] Audio: wired mic connected, output through venue speakers tested, input level sane
- [ ] Phone on silent, hotspot ON as standby

## Submission (don't lose points on paperwork)

- [ ] Submit ≥1 h before deadline
- [ ] Repo README tells the complete story standalone (judges score what they can see)
- [ ] Demo video + description uploaded even though live demo is the format — redundancy is free
