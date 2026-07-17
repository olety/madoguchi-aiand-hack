# Email → Status Extraction Prompt (the core ai& call)

Usage: system prompt below + one email per request (or small batches). Iterate against the 8
seed emails Thursday night on Moonshot direct API; swap baseUrl to ai& at check-in.
If ai& supports JSON mode / response_format, enable it; otherwise the fenced-JSON instruction
at the bottom is the fallback — parse the first ```json block in the reply.

---

## System prompt

```
あなたは会員企業管理システムのデータ抽出エンジンです。施設運営スタッフ宛のメールを読み、
会員企業のステータス変更を構造化データとして抽出します。

今日の日付: {{TODAY}}

会員企業リスト（この中からのみ照合すること）:
{{COMPANY_LIST_JSON}}   ← id, company_name, kana のみの軽量リスト

ルール:
1. メールが会員企業リストのどの企業に関するものか照合する。社名の表記ゆれ（略称、
   カナ、英語表記、「様」「御中」付き）を考慮する。確信が持てない場合は company_id を
   null にし、needs_human_review を true にする。
2. 抽出対象フィールドは payment_status / invoice_request_status / contract_status /
   renewal_date / note のみ。それ以外の情報（プラン変更希望、住所変更など）は
   field="note" として記録する。
3. 【最重要】updates の各項目には source_quote として、その判断の根拠となった
   メール本文中の文を「一字一句そのまま」引用すること。要約・言い換え禁止。
   この引用文は原文とのexact-match照合に使われる。
4. ステータス変更を含まないメール（挨拶、ノイズ）は classification="no_action" とし、
   updates は空配列にする。無理に抽出しない。
5. 金額・日付は本文に書かれたものだけを使う。推測で補完しない。
6. confidence は 0.0〜1.0。0.8 未満の update は needs_human_review を true にする。

許可される値:
- payment_status: 支払い済み | 入金待ち | 未払い | 督促中
- invoice_request_status: 送付済み | 未送付 | 作成中 | 不要
- contract_status: 有効 | 更新手続き中 | 解約予定 | 新規申込中
- renewal_date: YYYY-MM-DD
- classification: payment | renewal | invoice_request | cancellation | other | no_action
```

## Output JSON schema

```json
{
  "type": "object",
  "required": ["email_id", "company_match", "classification", "summary_ja", "updates", "needs_human_review"],
  "properties": {
    "email_id": { "type": "string" },
    "company_match": {
      "type": "object",
      "required": ["name_raw", "company_id", "confidence"],
      "properties": {
        "name_raw":   { "type": "string", "description": "本文/署名に現れた表記のまま" },
        "company_id": { "type": ["string", "null"] },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "classification": { "type": "string", "enum": ["payment", "renewal", "invoice_request", "cancellation", "other", "no_action"] },
    "summary_ja": { "type": "string", "description": "一行要約（タイムライン表示用、40字以内）" },
    "updates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["field", "new_value", "source_quote", "confidence"],
        "properties": {
          "field":        { "type": "string", "enum": ["payment_status", "invoice_request_status", "contract_status", "renewal_date", "note"] },
          "new_value":    { "type": "string" },
          "source_quote": { "type": "string", "description": "根拠文を原文から一字一句そのまま" },
          "confidence":   { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "needs_human_review": { "type": "boolean" }
  }
}
```

## Fallback instruction (no JSON mode on ai&)

Append to system prompt:

```
出力は必ず ```json フェンスで囲んだ単一のJSONオブジェクトのみとする。
フェンスの外に説明文を書かない。
```

Parser: take first ```json fence, `JSON.parse`, on failure retry once with the parse error
appended to the conversation ("直前の出力はJSONとして不正でした: {{error}}。修正して再出力。").

## Server-side handling (dashboard wiring)

- `source_quote` exact-substring match against the email body → char offsets → highlight in
  provenance drawer. If no exact match (model paraphrased), fall back to fuzzy match; if that
  fails, still store the quote but flag `needs_human_review`.
- `confidence < 0.8` or `needs_human_review` → row lands in review queue styling (amber dot),
  not silently applied. Demo line: "AI proposes, staff approves."
- Store every update as an event: `{company_id, field, old, new, source_email_id, source_quote, ts}`
  — this event log IS the timeline view.

## Expected results on the seed emails (regression targets)

| Email | Expect |
|---|---|
| 01 payment confirmation | Chromatonics → payment_status=支払い済み |
| 02 renewal reply | DeepFlow → contract_status=更新手続き中, renewal_date=2026-08-31 |
| 03 invoice request | Edge Photon → invoice_request_status=作成中 (依頼を受領) + note |
| 04 messy forward | QuantumForge → payment_status=督促中, needs_human_review likely true |
| 05 cancellation | Tobira Tech → contract_status=解約予定 |
| 06 payment delay apology | Aoi Densō → payment_status=未払い + note (7/25入金予定) |
| 07 plan change | Yamasemi → classification=other, field=note only |
| 08 address change | Kawasemi → classification=no_action, updates=[] |
