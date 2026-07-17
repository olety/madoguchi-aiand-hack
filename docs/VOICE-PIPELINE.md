# Voice Pipeline — architecture, commands, latency, fallbacks

Decision (settled 2026-07-15): **cascaded pipeline, Kimi on ai& is the only brain.**
Speech-to-speech products (OpenAI Realtime, Grok voice agents) rejected — they put *their*
model in the middle, which kills the "Use of ai&" judging axis and takes the per-company
isolation logic out of our hands. ASR/TTS are dumb peripherals; the reasoning is Kimi's.

```
mic (push-to-talk, ffmpeg avfoundation)
  → ASR: local MLX Qwen3-ASR (`transcribe`)          [~0.3–1 s, unmeasured locally]
  → Kimi K2.7 @ ai&  (caller's company row ONLY in context)   [TTFT: MEASURE AT CHECK-IN]
  → stream tokens, cut at 。！？!? , send whole clauses over the seam
  → TTS: Modal Qwen3-TTS-12Hz-1.7B-CustomVoice (streaming, seam WS)  [TTFB p50 315–366 ms]
  → speaker (PCM s16le 24 kHz mono, ~700 ms client jitter buffer)
```

Push-to-talk is a design choice, not a compromise — it maps naturally to phone turns
(caller speaks → pause → agent answers). There is no streaming-ASR-on-Mac path anyway.

## Build order (event day)

1. **Mock first, always.**
   ```bash
   cd ~/Desktop/code/eiri-voice/bench && uv venv .venv && uv pip install -e .
   .venv/bin/seam-server --backend mock --port 8765
   ```
   Build the whole client/player/turn loop against the mock. Swapping to real TTS is one URL.
2. **ASR** (model pre-downloaded at home — ~2.3 GB, never on venue wifi):
   ```bash
   ffmpeg -f avfoundation -i ":0" -t 4 -ar 24000 -ac 1 seg.wav
   transcribe seg.wav --no-summary
   ```
3. **Modal TTS deploy — at T-30 min before demo slot, keep warm through the demo:**
   ```bash
   cd ~/Desktop/code/eiri-voice && modal app list   # if eiri-voice* already deployed, reuse URL
   modal deploy server/modal_app.py                  # run from repo root (add_local_dir is cwd-relative)
   bench-ttfb --url wss://<workspace>--eiri-voice-worker-seam.modal.run --n 5 --feed llm
   ```
   Cold-start ladder: ~470 s first-ever boot · 90–110 s warm boot · **26–28 s snapshot restore**.
   Keep `min_containers=1` (or a periodic ping) through the demo window — never pay a cold
   path live.
4. **Kimi turn loop**: stream completion, cut at sentence enders, feed whole clauses to the
   seam (`text` msgs, then `end`). Whole clauses are load-bearing for JP prosody.

## Latency budget (per spoken turn)

| Stage | Budget | Status |
|---|---|---|
| ASR (local MLX, 4 s segment) | 0.3–1.0 s | unmeasured — check Thursday |
| Kimi TTFT @ ai& | **unknown — the biggest unknown in the whole demo. Measure at check-in.** | |
| TTS TTFB (Modal, Tokyo→us) | 0.32–0.48 s (p50–p95, measured 2026-07) | ✅ measured |
| Total turn | target ≤2.5 s | acceptable phone-support feel; narrate if slower |

TTFT mitigations if Kimi is slow: shorter system prompt, first reply sentence ≤15 chars
(faster TTS onset too), send the first clause the moment its 。 arrives.

## Isolation mechanism (rehearse this explanation)

1. Incoming caller number → lookup in `registered_phones` (the settings table on the dash).
2. Server injects **only that company's row** into the system prompt. Other rows never exist
   in the model's context — leakage is physically impossible, not merely disallowed.
3. Prompt-level refusal rules (see `prompts/voice-agent-prompt.md`) are the *backup*, and
   produce the polite on-stage refusal line.
4. Unregistered number → general facility info only + offer staff callback.
5. Production path (one sentence in Q&A): PIN or callback-to-registered-number; Twilio in
   front of the same pipeline.

## TTS text-shaping (bake into the voice agent prompt — already done)

1. Never open on a bare trigger word —「あ、もしもし、…」not bare「もしもし」(CN-prior pull).
2. 、only where a breath belongs — comma-splice = breathy drag.
3. First sentence short (≤~15 chars) → fast onset (30-char opener cost ~0.5 s TTFB).
4. Shape register in wording; don't stack emotion (fry-register risk).
5. End every chunk with 。！？; ≤~130 chars per utterance.

## Fallback ladder

| Tier | TTS | Trigger | Cost of switch |
|---|---|---|---|
| 1 | Modal Qwen3-TTS (ours) | default | — |
| 2 | Fish Audio (`wss://api.fish.audio/v1/tts/live`, ~$0.021/min, concurrency cap 5 at our spend tier — fine for one stream) | Modal down | URL change (seam-compatible via fish_proxy) |
| 3 | ElevenLabs (`skate get 11labs`) | Fish down | small adapter, prepped key |
| 4 | seam mock backend | everything down | narrate honestly, demo the turn loop |

ASR fallback: hosted Whisper (Fireworks, OpenAI-compatible `/v1/audio/transcriptions`) — same
URL-swap pattern (`transcribe seg.wav --server http://host:5092`). Latency unmeasured.
LLM fallback: Moonshot direct API (same model family) if ai& endpoint has issues — disclose
honestly if asked.

## Known pitfalls (from measured runs)

- PCM is fixed s16le 24 kHz mono — resample player-side.
- ~2 s default emit window → use ~700 ms client jitter buffer (or chunk12 deploy config).
- Don't tune Qwen3-TTS sampling — stock generation_config won all tuning arms.
- Deploy `modal_app.py` from the repo root or `add_local_dir` paths break.
