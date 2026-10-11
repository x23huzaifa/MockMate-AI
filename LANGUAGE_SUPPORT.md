# LANGUAGE_SUPPORT.md — InterviewSaathi AI

The honest capability matrix for Pakistan-first multilingual support.
**Rule: a language is only ever labeled at the support level it has earned.**
`verified` = corpus-tested end to end · `partial` = real content, limited
testing · `experimental` = best-effort, may be wrong · `unsupported` = not
offered. We never label a language "fully supported" because a template
produced a few sentences.

## The four settings

| Setting | Controls | Stored |
| ------- | -------- | ------ |
| `interviewLanguage` | The language questions are asked in | Per user (`user_language_settings`) + per session (`interview_sessions`) |
| `responseLanguage` | What the candidate may answer in (a promise, not a lock — answers are stored verbatim in any language) | Per user + per session |
| `feedbackLanguage` | The language evaluations are written in | Per user + per session |
| `evaluationLanguage` | The language used for scoring rubric keywords | Per user + per session |

Session values are copied at creation: changing user defaults later never
rewrites a session's behavior.

## Capability matrix

| Language | Questions | Evaluation keywords | Feedback templates | Code-switch handling | Test coverage | Limitations |
| -------- | --------- | ------------------- | ------------------ | -------------------- | ------------- | ----------- |
| English (`en`) | `verified` — 40-question bank (5 intro / 15 technical / 10 behavioral / 10 situational), seeded deterministic selection | `verified` — full English keyword overlap + stopwords | `verified` — full per-dimension templates | n/a (base language) | `verified` — corpus cases EN-1…EN-5 + unit tests | None known |
| Urdu script (`ur`) | `partial` — **exactly 10** hand-written questions (5 intro / 5 behavioral); technical stays English | `partial` — hand-written Urdu stopwords (~90) + ~25 keyword translations | `partial` — hand-written per-dimension templates | Mixed Urdu+English answers score on both token sets; never penalized | `partial` — corpus cases UR-1…UR-5, limited runs | Technical + situational questions fall back to English; keyword list is small; no TTS/STT claim |
| Roman Urdu (`roman-ur`) | `partial` — **exactly 10** hand-written questions (5 intro / 5 behavioral); technical stays English | `partial` — Roman-Urdu stopwords (~100) + ~25 keyword translations; English loanwords (team, deadline, project) match directly | `partial` — hand-written per-dimension templates | `partial` — Roman Urdu + English mixing is first-class: mixed answers score relevance ≥ pure-English equivalents (tested) | `partial` — corpus cases RU-1…RU-5 + CS-1…CS-5 | Same as Urdu script; Roman spellings vary (nahi/nahin) — matching is best-effort |
| Punjabi Roman (`pa-roman`) | `unsupported` — no bank | `experimental` — language-agnostic heuristics only (length/structure); keyword relevance may under-score | `unsupported` — falls back to English (logged) | Accepted verbatim; not penalized for script | `experimental` — accepted-input cases only | No questions, no templates, no keyword list |
| Pashto (`ps`) | `unsupported` | `experimental` — same as above | `unsupported` — falls back to English (logged) | Accepted verbatim | `experimental` | Same as Punjabi Roman |
| Sindhi (`sd`) | `unsupported` | `experimental` — same as above | `unsupported` — falls back to English (logged) | Accepted verbatim | `experimental` | Same as Punjabi Roman |
| Saraiki (`skb`) | `unsupported` | `experimental` — same as above | `unsupported` — falls back to English (logged) | Accepted verbatim | `experimental` | Same as Punjabi Roman |
| Balochi (`bal`) | `unsupported` | `experimental` — same as above | `unsupported` — falls back to English (logged) | Accepted verbatim | `experimental` | Same as Punjabi Roman |

## Exact content counts (no inflation)

- English questions: **40** (`server/ai/templateProvider.ts` `QUESTION_BANK`)
- Urdu-script questions: **10** (`URDU_QUESTION_BANK`) — asserted in `multilingual.test.ts`
- Roman-Urdu questions: **10** (`ROMAN_URDU_QUESTION_BANK`) — asserted in `multilingual.test.ts`
- Feedback template sets: **3** (`en`, `ur`, `roman-ur` in `server/ai/feedbackTemplates.ts`)
- Keyword translation lists: **2** (~25 entries each, `ur` + `roman-ur`)

## Guarantees that hold in every language

1. **Original transcript preserved verbatim.** `interview_answers.answerText`
   stores exactly what the candidate typed. No normalization happens before
   storage; there is no `normalizedText` column because we do not normalize.
2. **No language penalty.** The old tokenizer (`[^a-z0-9]`) silently deleted
   non-Latin words; Phase D tokenization is Unicode-aware (`\p{L}`) with
   per-language stopwords, so Urdu/Pashto/Sindhi answers keep their words.
3. **Fallbacks are logged, never silent.** `feedbackStringsFor()` logs a
   warning when falling back to English.
4. **UI chrome stays English** (Phase D scope decision): buttons, nav, and
   labels are English; only question text, answer input (`dir="auto"`), and
   feedback honor RTL/script settings. Urdu-script content renders with
   `dir="rtl"` and a Nastaliq-capable font stack.

## Voice (browser speech) — Phase E, all `experimental`

Voice is a client-side enhancement layer (`client/src/lib/voice.ts`,
Web Speech API only — no services, no keys, no new DB tables). Text always
works identically with voice unavailable. Full matrix: `VOICE_SUPPORT.md`.

| Language | Speech input (mic) | Read-aloud |
| -------- | ------------------ | ---------- |
| English (`en` → `en-US`) | `experimental` — works in Chrome/Edge desktop where STT is supported; Firefox/Safari have no STT API | `experimental` — works where an English voice is installed (most systems) |
| Urdu (`ur` → `ur-PK`) | `experimental` — Chrome's `ur-PK` model exists but is untested by us | `experimental` — only if an Urdu voice is installed; the UI says plainly when none is ("No Urdu voice installed in this browser — showing text"), never substitutes English |
| Roman Urdu (`roman-ur` → `ur-PK` model) | `experimental` — **no Roman-Urdu speech model exists**; transcript may come back in Urdu script — it stays editable and the UI documents the mismatch | `experimental` — via the Urdu voice if installed; best-effort pronunciation |
| Punjabi Roman / Pashto / Sindhi / Saraiki / Balochi | `unsupported` as STT targets (falls back to `en-US`, says so); answers always accepted as typed text | `unsupported` — never faked |

Also: STT in Chrome/Edge sends audio to the provider's servers (needs
internet) — the UI-adjacent docs say so; we store only submitted text,
never audio. The Urdu-script and Roman-Urdu text rows above previously said
"no TTS/STT claim" — that claim now exists and is `experimental`, earned
only after the real-browser checklist in `TESTING.md` passes.

## What "experimental" honestly means

For `pa-roman`, `ps`, `sd`, `skb`, `bal`: you may select them as your
*response* language and answer freely — we store every word and score
length/structure fairly. But questions, feedback, and keyword scoring are
English-only there. We would rather show "experimental" than fake fluency.
