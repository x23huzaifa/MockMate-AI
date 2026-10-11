# LANGUAGE_TEST_CASES.md — InterviewSaathi AI

Documented multilingual test corpus (Phase D). Each case states the input,
the expected behavior, and the acceptance bar. A language is marked
`verified` in `LANGUAGE_SUPPORT.md` only when ≥80% of its cases behave as
specified; otherwise it stays `partial`/`experimental`. Automated checks
for the deterministic cases live in `server/ai/multilingual.test.ts`;
the rest are manual on the PC (`pnpm dev` + real sessions).

Conventions: `IL` = interviewLanguage, `FL` = feedbackLanguage,
`EL` = evaluationLanguage at session creation.

## English (EN-1 … EN-5) — bar: ≥4/5 pass → `verified`

- **EN-1** — IL=en, FL=en, EL=en. Answer a behavioral question with a
  120-word STAR-style answer containing "team", "deadline", "result".
  Expected: relevance ≥ 4, feedback in English mentioning strengths.
- **EN-2** — Same session setup, answer "idk" (3 chars). Expected: all
  dimensions ≤ 2, improvements listed in English, no crash on tiny input.
- **EN-3** — FL=ur while IL=en (cross-language feedback). Expected:
  feedback text in Urdu script, scores still computed from the English
  answer. (Proves feedback language is independent of question language.)
- **EN-4** — EL=roman-ur while answering in English. Expected: no score
  collapse vs EL=en (relevance within ±1) — keyword expansion must not
  break English scoring.
- **EN-5** — Empty-string answer submitted via API. Expected: 400
  "Answer text is required." (validation, not a 1/5 score).

## Urdu script (UR-1 … UR-5) — bar: ≥4/5 pass → `verified` (currently `partial`)

- **UR-1** — IL=ur. Expected: Q1 rendered right-to-left in Urdu script
  (`dir="rtl"`), from the 10-question Urdu bank.
- **UR-2** — IL=ur, FL=ur, EL=ur. Answer in Urdu mentioning تجربہ، ٹیم،
  نتیجہ (≥40 words). Expected: relevance ≥ 2 (Urdu keyword overlap works),
  feedback + honesty note in Urdu script.
- **UR-3** — IL=ur, count=8. Expected: intro + behavioral in Urdu;
  technical questions in English (documented fallback), session still
  completes — mixed-language sessions must not break the state machine.
- **UR-4** — FL=ur on an English-question session. Expected: per-answer
  feedback and report render RTL in Urdu; dimension bars unchanged.
- **UR-5** — One-word Urdu answer ("ٹھیک"). Expected: low scores (honest),
  feedback still well-formed Urdu, no exception.

## Roman Urdu (RU-1 … RU-5) — bar: ≥4/5 pass → `verified` (currently `partial`)

- **RU-1** — IL=roman-ur. Expected: Q1 in Roman Urdu (e.g. contains
  "batayein"/"aap"), LTR rendering.
- **RU-2** — IL=roman-ur, FL=roman-ur, EL=roman-ur. 60-word Roman-Urdu
  answer with "team", "deadline", "project". Expected: relevance ≥ 3,
  feedback in Roman Urdu ("score 5 mein se …").
- **RU-3** — Same but answer uses variant spellings ("nahin" vs "nahi",
  "mein" vs "me"). Expected: no crash; scores within ±1 of RU-2
  (best-effort tolerance, documented limitation).
- **RU-4** — FL=ps (unsupported). Expected: feedback falls back to
  English AND the server logs `[feedbackTemplates] No feedback templates
  for "ps"` — fallback is never silent.
- **RU-5** — EL=en while answering in Roman Urdu. Expected: relevance
  within ±1 of EL=roman-ur (loanwords carry the match; honest, not
  inflated).

## Code-switched (CS-1 … CS-5) — bar: ≥4/5 pass → mixed answers never penalized

- **CS-1** — IL=en, EL=roman-ur. Answer: "Main ne team ko lead kiya aur
  project deadline se pehle complete kiya. Planning achi thi."
  Expected: relevance ≥ pure-English equivalent's relevance (tested in
  `multilingual.test.ts`).
- **CS-2** — IL=ur, answer mixes Urdu script + English tech terms
  ("میں نے React میں component بنایا"). Expected: relevance ≥ 2 —
  English loanwords inside Urdu text still match.
- **CS-3** — Answer switches mid-sentence three times (EN→RU→EN).
  Expected: no dimension scores 1 *solely* from language mixing; depth
  reflects word count honestly.
- **CS-4** — IL=roman-ur, FL=en. Expected: Roman-Urdu questions, English
  feedback — the four settings stay independent.
- **CS-5** — Response language set to `ps`, answered in Pashto
  (experimental). Expected: stored verbatim, scored with
  language-agnostic heuristics only, UI labels the language
  "experimental" — no fake Pashto feedback generated.

## Acceptance thresholds (summary)

| Group | Cases | Bar for `verified` | Current status |
| ----- | ----- | ------------------ | -------------- |
| English | EN-1…EN-5 | ≥4 pass | `verified` (unit-tested) |
| Urdu script | UR-1…UR-5 | ≥4 pass | `partial` (unit-tested, manual pending) |
| Roman Urdu | RU-1…RU-5 | ≥4 pass | `partial` (unit-tested, manual pending) |
| Code-switched | CS-1…CS-5 | ≥4 pass | `partial` (CS-1 unit-tested, rest manual) |

Manual cases run on the PC after `pnpm dev`; record pass/fail per case in
`TESTING.md` when executed. Until then, non-English groups stay `partial`
no matter how good the templates look — that is the honesty rule.
