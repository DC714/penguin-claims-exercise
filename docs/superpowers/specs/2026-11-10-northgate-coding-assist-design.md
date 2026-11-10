# Northgate Coding Assist: Design

Date: 2026-11-10
Status: approved in brainstorming, pending written-spec review

## Goal

For each Northgate Family Clinic visit, (1) suggest codes from the Northgate
coding manual v3.2, each backed by the sentence in the note that supports it,
and (2) flag whether Harborline will likely deny the claim, and under which
rule (HR-01..HR-08), with a suggested fix. Output goes to Northgate coders for
review before billing. Time budget: about 3h35m from spec approval.

## Decisions

| Topic | Decision |
|---|---|
| Extraction | Deterministic rules first. An LLM handles only low-confidence visits, run locally through Dave's Claude Code subscription (`claude -p`). No API key in the hosted app. |
| Hosting | GitHub repo, Next.js on Vercel, Neon Postgres. Inngest deferred (needs an API key; out of scope for this pass). |
| Authority on conflicts | The Northgate manual decides what to code. Harborline rules produce warnings with a billable alternative. |
| Telehealth | Suggest V-150 (manual G5). Flag HR-02 and offer "billable form: V-110 + M-95". |
| Evidence | Every code carries a quoted evidence sentence (G11, Compliance requirement). A code without evidence is never emitted. |
| Provenance | Every suggestion stores `source`: `rules-v1` or the producing model, e.g. `sonnet-5.5`. Unique on (visit, source, code), so models can be compared per visit. |

## Units

1. **engine/**: pure TypeScript, no I/O.
   - `parseNote(text)`: member ID, date, provider, time, sentences (handles the
     `S/O:`, bullet and paragraph templates).
   - `suggestCodes(note)`: `{code, evidence, rule, confidence}[]` per G1..G11.
   - `checkDenials(claim, ctx)`: `{ruleId, why, fix}[]` for HR-01..HR-08, using
     roster, prior authorizations (approved/expiry vs date of service) and the
     member's other visits (HR-07).
2. **ingest/**: local script. Reads xlsx, 50 PDFs, roster, the six prior
   authorizations. Normalizes dates and IDs, fills the 9 missing member IDs
   from note text, de-duplicates the 6 visits present in both sources, writes
   to Neon.
3. **escalate/**: local script. Sends low-confidence visits (note, code table,
   rules only) to `claude -p`, expects JSON with codes and quotes, accepts a
   code only if its quote is a literal substring of the note. Stores rows with
   `source` set to the model that answered.
4. **web/**: Next.js review queue. Visit list sorted by denial risk; visit view
   with highlighted evidence, suggested codes per source, denial flags, and
   per-code accept/reject saved to Neon; comparison view against the 40 coder
   examples and between sources.

## Data model (Neon)

`visits`, `members`, `prior_auths`, `suggestions (visit_id, source, code,
evidence, rule, confidence)`, `denial_flags (visit_id, source, rule_id, why,
fix)`, `reviews (visit_id, source, code, decision, reviewer, at)`.

## Extraction rules (summary)

- Visit code: telehealth wording -> V-150; wellness/annual -> V-200 + D-113;
  same-day acute add-on -> V-300; else level from documented minutes, V-120 if
  no time.
- Procedure coded only if performed. "offered / declined / recommended /
  ordered" suppress it. Incomplete -> M-52. Same-day separate problem -> M-25
  on V-code; procedure-only visit -> P- and D-, no V-.
- D-codes: dictionary match, main problem first, max four.
- Low confidence: negated/hedged text, missing time, code or procedure outside
  the table (G10, never assigned, asks provider), competing readings.

## Denial checks

HR-01 Bronze + P-310/320/330 needs a matching approval valid on the date of
service. HR-02 V-150. HR-03 more than one V-. HR-04 P-210 with P-220. HR-05
only D-codes. HR-06 V-130/140 without documented 30/45 min. HR-07 second V-200
within 365 days. HR-08 V- with P- lacking M-25. A second pass shows what the
clinic's own coding would hit.

## Testing

Unit tests per rule with fixtures. The 40 coded examples feed a comparison
report, not a pass/fail gate, because some coder answers conflict with the
bulletin. Each mismatch is classed as engine bug, coder error, or
manual-vs-bulletin conflict.

## Deliverables

Repo with README, decision log, the deployed app URL, and after the build a
telehealth brief (manual G5/M-95 vs HR-02, what the coded examples show, open
questions for the clinic and Harborline).

## Build order

Engine + tests (~90 min), ingest + Neon (~35), web (~50), escalation (~20),
docs (~20), buffer for the rest.

## Out of scope

Inngest/background uploads, the practice-management work-queue API (docs not
yet available), authentication beyond a reviewer name field.
