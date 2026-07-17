# Judge Q&A Prep — rehearsed answers

Personas expected: Tokyu Land / domain judge (sponsor rep), ai&/Moonshot technical judge,
skeptical generalist. Q&A psychology: 2-second pause before hard answers; never argue —
acknowledge, appreciate, pivot; own unknowns ("here's how we'd find out").

---

## Scope (guaranteed to come up)

**Q: The brief said build the smallest MVP for ONE workflow. You built three things. Why?**
> It is one workflow — "staff instantly answers a member company's status" — served through the
> three channels staff already use: screen, email, phone. Same database, same model, three doors.
> We cut everything else: no auth, no billing engine, no admin panel, no Slack integration.

**Q: Isn't this just a CRUD app with a chatbot bolted on?**
> The dashboard is the least interesting part — we built it in the first hour and froze it.
> The product is the ingestion: the system updates *itself* from the channels where the
> information already lives. That's the manual work the brief names.

## Trust & accuracy (domain judge)

**Q: What happens when the AI extracts the wrong payment status from an email?**
> Every status is clickable — it opens the exact source sentence it came from, so staff verify
> in one glance. Extraction proposes, humans confirm. Same human-in-the-loop pattern as our
> email sending. *(Open the provenance drawer while answering.)*

**Q: What if the voice agent tells a caller something wrong?**
> It can only state what's in the database row — it has no other knowledge in context, and we
> instruct it to say "let me have staff call you back" for anything outside those fields. The
> transcript is logged, so staff review every answer it gave.

**Q: Financial and contract data in a cloud LLM — what about privacy?**
> The data lives in our database, not in the model. Per call, only the caller's own row enters
> the context window — nothing else exists for the model. For production: domestic hosting and
> a DPA with the inference provider would be the first conversation.

## Voice & isolation (both judges)

**Q: How do you know the caller is really from Company A?**
> Caller ID matched against registered numbers before any data loads — you saw the settings
> table. Production adds PIN or a callback to the registered number. The isolation itself
> doesn't depend on the model behaving: other companies' rows are never in its context.

**Q: What's the latency? Felt slow / felt fast?**
> Cascaded pipeline: local ASR, Kimi on ai&, streaming TTS at ~350 ms first-byte. Turn time is
> one-to-two seconds — phone-support territory. We chose cascaded over a speech-to-speech API
> deliberately: it keeps Kimi on ai& as the brain, and keeps the caller's data isolation in
> our hands, not a third-party voice product's.

**Q: Is the voice live or a video?**
> Live. *(If it was the fallback video: "That run was recorded an hour ago when the venue
> audio failed us — happy to run it live for you right now at the table.")*

## Technical (ai&/Moonshot judge)

**Q: Where exactly does ai& run in this?**
> Three places: structured extraction from raw emails, drafting the renewal reminders, and the
> voice agent's reasoning. Remove ai& and the product collapses to an empty spreadsheet.

**Q: How reliable is the structured extraction?**
> Schema-constrained JSON with per-field confidence and a needs-human-review flag; low
> confidence routes to a review queue instead of silently updating. On our seed set it's
> 8-for-8, but the design assumption is that it *will* err — that's why provenance exists.

**Q: Why not RAG / fine-tuning?**
> Sixteen companies fit in a context window; retrieval would be theater at this scale. At real
> scale — hundreds of members, years of email — retrieval over the message archive is exactly
> the next step, and the provenance schema we built is already the retrieval index.

## Business (generalist)

**Q: Why wouldn't they just use Salesforce / kintone / a spreadsheet?**
> Those still require a human to read every email and type the status in. Our differentiator
> is that the system feeds itself from the communication channels — that's the manual work
> the sponsor described. kintone could even be the *storage* layer in a pilot; the value is
> the ingestion and answering layer on top.

**Q: What does this cost to run?**
> Per-email extraction is a fraction of a yen at ai& pricing; voice minutes are the main cost
> and still cents. For a facility with dozens-to-hundreds of members, tens of dollars a month —
> versus staff hours today.

## Hard/curveball

**Q: You had voice infrastructure pre-built. Is that fair?**
> The voice *plumbing* (TTS serving, ASR script) predates the event, like using any API or
> open-source library. Everything specific to this product — the extraction schema, the
> isolation design, the dashboard, the agent behavior, the integration — was built today, on
> Kimi K2.7 on ai&.

**Q: What breaks first at 500 member companies?**
> The context-stuffing shortcut: today the whole roster could fit in one prompt, at 500 you
> need retrieval and a review queue with priorities. The schema already supports both. Second:
> caller-ID collisions (shared switchboards) — that's when PIN verification stops being
> optional.
