# Lexicon — Multilingual Glossary App

A glossary web app for cross-border software teams, built to keep technical terminology consistent when the same term has to travel between Japanese, Vietnamese, English and Chinese.

**Live demo → https://multilingual-glossary-app.vercel.app/**

<!-- Chèn ảnh chụp màn hình ở đây. Lưu file vào /public/screenshot.png -->
<img width="2212" height="1958" alt="image" src="https://github.com/user-attachments/assets/7e02c82c-1f0c-464d-8df3-dd2cebdf151d" />


---

## Why I built it

I work as a bridge engineer between a Japanese client and a Vietnamese development team, and the same problem kept coming back: one technical term, three different translations depending on who wrote the ticket. Small inconsistencies compound into real misunderstandings once they reach a specification.

A shared spreadsheet solved the storage problem but not the lookup problem — nobody opens a spreadsheet in the middle of a meeting. So I kept the spreadsheet as the place terms live, and built an app on top of it that stays in sync in both directions: you can capture a term the moment it comes up in a meeting without leaving the app, and the spreadsheet still works as the place to audit and bulk-edit everything.

## What it does

Three curated glossaries — **IT Japanese**, **Advanced Chinese**, **Business English** — each with its own translation set and reading format:

| Tab | Translations shown | Reading |
|---|---|---|
| IT Japanese | EN · VI · ZH | Romaji |
| Advanced Chinese | EN · VI · JA | Pinyin |
| Business English | VI · JA · ZH | Pronunciation guide |

- **Real-time search** scoped to the active tab
- **Progressive disclosure** — cards show term, reading and translation badges; expanding reveals definition, example and tags
- **Long-form detail notes** with a rich-text editor for terms that need more than a one-line definition
- **Server-side pagination** with a selectable page size (5 / 10 / 20)
- **Two-way sync with Google Sheets** — add, edit or delete a term in the web UI and it propagates to the spreadsheet automatically; edit the spreadsheet and it flows back to the app. Neither side is read-only.
- **Responsive** from 375px up — tested against iPhone 13 as the baseline

## Architecture

```
                    ┌──────────── async write-back ────────────┐
                    ▼                                          │
Google Sheets  ──sync──▶  D1  ──cache──▶  KV  ──reads──▶  React frontend
(source of truth        (SQL)                                  │
 for content)             ▲                                    │
                          └────────── writes ──────────────────┘
                                    (via Worker)
```

The sync is **bidirectional**. Spreadsheet edits flow forward through D1 to the app; UI edits are written to D1 and pushed back into the spreadsheet asynchronously. Both surfaces are fully editable, which is what most of the engineering below exists to make safe.

**Google Sheets is the source of truth for content.** All manual entry and human auditing happens there — it is the interface non-technical collaborators already know. On any conflict during recovery, Sheets wins.

**D1 is the source of truth for `word_id`.** IDs are generated at insert time in D1 and written back into a locked column A in Sheets. Splitting authority this way was the key design decision: content and identity have different lifecycles, and treating them the same causes sync corruption.

**KV caches hot reads** and is invalidated on every sync.

**The frontend never reads Sheets directly.** All reads go through D1 via a Worker, which returns ready-to-render payloads — empty translation fields are stripped from the response entirely rather than rendered as blank slots.

### Handling partial failures

UI writes hit D1 first, then propagate asynchronously to Sheets. When that second write fails, the entry is logged to a `pending_sheets_sync` table with its operation type, payload snapshot and retry count. A scheduled Worker replays the queue **in insertion order** — an `UPDATE` must never run before the `INSERT` it depends on. Entries exceeding five retries are marked `dead` and surfaced for manual reconciliation.

Deletions never address Sheets by row index, since rows shift. The Sheets client scans column A for an exact `word_id` match and operates on the row it discovers.

### Security

Admin routes sit behind Cloudflare Access. The Worker does not trust the `CF-Access-JWT-Assertion` header on its own — middleware verifies the token signature on every protected write, so a spoofed header does not reach D1. The React frontend checks auth state for rendering and routing only, never as a substitute for backend enforcement. CORS origins live in a single environment variable rather than in code.

## Tech stack

TypeScript · React · Vite · Cloudflare Workers · D1 · KV · Google Sheets API · Vercel

## Project structure

```
worker/src/
├── index.ts            Entry point, routing
├── routes/             glossary · sync · admin
├── middleware/         auth · cors · errorHandler
├── db/                 queries.ts · schema.sql
├── cache/              kv.ts
├── services/           sheets · syncLogger · retryQueue
└── types/              Shared TypeScript types
```

## Running locally

```bash
npm install
npm run dev          # frontend at http://localhost:5173
```

Frontend environment variables go in `.env.local`: `VITE_WORKER_URL`, `VITE_CF_CLIENT_ID`, `VITE_CF_CLIENT_SECRET`.
Worker bindings (D1, KV, cron trigger for the retry queue) are configured in `wrangler.toml`.

## What I learned

I come from a linguistics and business-analysis background rather than a development one, so this project was as much about writing a specification I could build against as about the code itself. Most of the design — the split source of truth, the retry queue ordering rule, the decision to strip empty fields at the serialization layer rather than in the UI — was written down and argued through before any implementation started.

That turned out to be the transferable part. Specifying exactly where a system is allowed to fail, and what happens when it does, is the same work I do when writing requirements for a development team.

## Roadmap

- [ ] Alerting when entries reach `dead` status in the retry queue
- [ ] Tag-based filtering across tabs
- [ ] Export a term set to CSV for team sharing
- [ ] AI-assisted enrichment for definitions and example sentences

---

Built and maintained by [Lê Trần Khánh An](https://github.com/khanhan181230).
