# AI_SETUP.md — Google Gemini setup for MockMate AI


> **Model note (verified 2026-10-12):** `gemini-2.5-flash` is no longer available to new API keys — Google's API returns 404 directing to `gemini-3.8-flash`. The default is now `gemini-3.8-flash`.

MockMate AI ships with a **built-in template engine** (demo mode) that works
with zero configuration. Setting up **Google Gemini** (free tier) upgrades
interviews to real LLM-generated questions/evaluations and unlocks the
**AI career chat** (`/chat`).

No code changes needed — only two lines in `.env`, then restart.

## 2-minute setup (Windows)

1. Open **https://aistudio.google.com** and sign in with a Google account.
2. Click **"Get API key"** → **"Create API key"** (no credit card required).
3. Copy the key (starts with `AIza…`).
4. In `D:\interview-saathi-ai-scaffold\.env`, add:
   ```ini
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIza...paste-your-key-here
   ```
   (`GEMINI_MODEL` is optional — it defaults to `gemini-3.8-flash`.)
5. Restart the dev server (`Ctrl+C`, then `pnpm dev`).
6. Watch the startup log — you should see:
   ```text
   [mockmate-ai] AI provider: gemini (model gemini-3.8-flash)
   ```
   If you instead see `template/demo mode`, the key wasn't picked up
   (typo, wrong `.env` file, or server not restarted).

To go back to demo mode: set `AI_PROVIDER=template` (or delete the two
lines) and restart. Or keep the key but pin templates temporarily with
`AI_MODE=force-template`.

## Free-tier limits (verified 2026-10-12, Google AI Studio)

| Model | Requests/min | Requests/day | Notes |
|---|---|---|---|
| `gemini-3.8-flash` (default) | ~15 | ~1,500 | Best free-tier limits; default |
| `gemini-3.8-flash-lite` | ~15 | ~1,500 | Faster/cheaper, slightly weaker |
| `gemini-3.5-flash` | lower | lower | Newer, tighter free quota |
| `gemini-3.6-flash` | lower | lower | Newer, tighter free quota |
| `gemini-2.5-pro` | ~5 | ~50 | Avoid as default — quota too strict |

Limits change; the current numbers live at
https://aistudio.google.com → *API pricing/limits*. Hitting the limit does
**not** break interviews: the app falls back to the template engine and
shows *"AI is busy, try again in a moment"*.

> ⚠️ **Never enable billing** on the free-tier project — that ends the free
> tier. The free quota is plenty for practice use.

## Environment variables

| Variable | Values | Default | Effect |
|---|---|---|---|
| `GEMINI_API_KEY` | key from AI Studio | *(unset)* | Enables the real LLM |
| `GEMINI_MODEL` | model id | `gemini-3.8-flash` | Which Gemini model to call |
| `AI_PROVIDER` | `gemini` \| `template` | `template` | Explicit opt-in for Gemini |
| `AI_MODE` | `auto` \| `force-template` | `auto` | `force-template` pins the built-in engine |

Selection logic: Gemini serves **only if** `AI_PROVIDER=gemini` **and**
`GEMINI_API_KEY` is set **and** `AI_MODE` is not `force-template`.
Everything else → template/demo mode. A missing key never crashes startup.

## How to tell which engine answered

The app never labels template output as Gemini:

- **Interview report** (`/interview/:id/report`): the `providers` block
  (`{ questions: "gemini"|"template", evaluations: [...] }`) and the
  `methodNote` footer name the actual engine per question.
- **Chat page** (`/chat`): the banner reads `/api/v1/health`'s `ai` block —
  *"Gemini-powered (model X)"* vs *"Demo mode — AI not configured."*
- **API**: `GET /api/v1/health` → `ai: { provider, model, configured }`.
  App health (`ok`) and AI health (`ai.configured`) are distinguishable.

## Privacy note

- The API key lives **only** in server-side `.env` — never in client code,
  never in git (`.env` is gitignored).
- Interview questions, answers, and CV skills sent to Gemini are **not
  logged** by the app.
- Google's free tier **may use API data for product improvement**
  (https://ai.google.dev/gemini-api/terms). Don't paste passwords, tokens,
  or other secrets into chat or answers — the app never sends them, and
  neither should you.

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| Startup says `template/demo mode` | `AI_PROVIDER` isn't `gemini`, key missing/blank, or server not restarted after editing `.env` |
| `AI is busy, try again in a moment` | Free-tier quota hit (429) — interview continued on the template engine; wait a minute and retry |
| Chat: `AI chat is not configured` (503) | Key or `AI_PROVIDER=gemini` missing — chat has no template fallback by design |
| `Gemini rejected the API key` | Wrong/revoked key — regenerate at AI Studio |
| Report says `template` for some questions | Mixed session: quota failed mid-interview and those answers fell back honestly |

## For developers

- Provider code: `server/ai/` (`config.ts`, `errors.ts`,
  `geminiProvider.ts`, `chatProvider.ts`, `templateProvider.ts`).
- Selection + safe fallbacks: `server/ai/index.ts`
  (`aiStatus()`, `getQuestionProvider()`, `safeGenerateQuestions()`,
  `safeEvaluate()`).
- Unit tests mock the SDK client — no real API calls in `pnpm test`.
