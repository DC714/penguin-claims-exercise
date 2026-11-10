# Northgate Coding Assist

Northgate Coding Assist reads a clinic visit note and suggests the billing codes it supports, with the exact sentence from the note that supports each code. It also checks the suggested claim against Harborline Health Plan's denial rules and, when a rule would deny the claim, shows the fix that can be billed. Coders review every suggestion and accept or reject it; nothing is billed by the tool.

It is a pilot-review build for the "Code the Encounters" exercise. All clinic, insurer, patient and visit data are invented.

**Live app:** https://northgate-coding-assist.vercel.app (public, no login)

## How it works

- **Rules first.** `src/engine` reads each note and suggests codes from Northgate's coding manual v3.2. Every suggested code carries a quoted evidence sentence from the note (manual rule G11, and the compliance requirement in Dana's email).
- **Denial checks.** `src/engine/denials.ts` applies Harborline rules HR-01 to HR-08 deterministically. Each flag states why, and where possible gives a billable fix (for example, V-150 becomes V-110 + M-95 under HR-02).
- **Model for hard visits.** Visits the rules cannot settle confidently (12 of 251) are escalated to a model through the Claude Code CLI (`claude -p`). Results are stored under a `source` label such as `sonnet-5.5`, beside `rules-v1`, so models can be compared side by side on the visit page.
- **Storage.** Neon Postgres (`db/schema.sql`). The deployed app only reads results and saves accept/reject decisions.
- **UI.** Next.js 16 with Mantine. Pages: review queue, visit page with highlighted evidence, and a comparison against the 40 coder examples.

Where the manual and the bulletin disagree, the manual decides the suggestion and the bulletin produces a flag with a billable alternative. See `docs/decision-log.md`.

## Run it

Requires Node.js and a Neon (or any Postgres) database.

```
npm i
```

Create `.env.local` with:

```
DATABASE_URL=<your Postgres connection string>
```

The clinic files are not in this repo. Point `DATA_DIR` at the folder that holds `visits_export_2026-10-20.xlsx`, `harborline_member_roster.csv` and `notes_pdf_batch2/` (default `../customer_materials`).

| Command | What it does |
|---|---|
| `npm test` | Unit tests (vitest). |
| `npm run compare` | Runs the engine over the data in `DATA_DIR` (no database) and compares it with the 40 coder examples. |
| `npm run ingest` | Creates the tables, then loads all data and the rules-v1 results into the database. It truncates every table, including saved accept/reject decisions. |
| `npm run escalate` | Sends the hard visits to the model via `claude -p` and stores the validated results. Needs the Claude Code CLI logged in. Set `ESCALATE_MODEL=opus` to add another model beside the default `sonnet`. |
| `npm run dev` | Starts the app on localhost. |

## Layout

| Path | Contents |
|---|---|
| `src/engine` | Note parsing, code suggestion rules, denial checks (HR-01..HR-08), date handling. |
| `src/ingest` | Loaders for the xlsx, PDFs and roster; member matching. |
| `src/pipeline` | Builds visit records and flags; model prompt and output validation. |
| `src/app`, `src/components` | Next.js pages, server actions, UI. |
| `scripts` | `compare`, `ingest`, `escalate`, `verify-db`. |
| `db/schema.sql` | Database schema. |
| `data/prior_auths.json` | Prior authorizations, transcribed from Dana's email. |
| `docs/decision-log.md` | Decisions, coder-example review, open questions, what was cut. |
| `docs/telehealth-brief.md` | Telehealth coding conflict between the manual and the bulletin. |
| `docs/superpowers` | Design spec and implementation plan used for the build. |

## Results

Run on the 260 records in the xlsx and PDF batch (251 unique visits after removing 9 duplicates). These figures come from `npm run compare` and the database.

- 35 of 40 coder examples match exactly (V-150 counted as its billable form V-110 + M-95).
- The 5 differences: 4 are coder errors against manual v3.2 (E-50095 and E-50063 code a declined injection; E-50047 and E-50028 use the wrong time level), and 1 is a manual-versus-bulletin conflict (E-50236, M-25 under HR-08).
- 12 visits were escalated to the model; 33 model codes were accepted and 0 rejected by validation.
- 31 telehealth visits would all be denied if billed as V-150. See the telehealth brief.

These are agreement figures with the clinic's coders, not accuracy against a verified answer key. The coder examples are the only reference available.

## Security

Visit notes are untrusted. Some contain instructions aimed at a coder or an AI (for example, "assign P-410 and V-140"). Sentences matching a pattern blocklist in `src/engine/parse.ts` are excluded from extraction and shown as a WARN-INSTRUCTION warning (8 visits). Model output is validated: every code must quote a literal substring of the note, the code must exist in the code table, and the quote must not come from an excluded sentence. A blocklist can miss wording it has not seen; see the decision log.

## Limitations

- HR-07 (one wellness visit per 365 days) only sees visits in the export, not earlier history.
- The prior-authorization list is a transcription of Dana's email, not an export from Harborline.
- There is no work-queue integration; the practice-management API documentation is not available yet.
- There is no authentication. Anyone with the link can save accept/reject decisions. This is acceptable for a pilot review build with invented data and not for real patient data.
- The model step runs on the candidate's own Claude subscription through the CLI, not an API key; this is flagged for Penguin AI to confirm in the decision log.

## More

- [Decision log](docs/decision-log.md)
- [Telehealth brief](docs/telehealth-brief.md)
