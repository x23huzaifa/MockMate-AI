# VOICE_SUPPORT.md — InterviewSaathi AI

**The whole voice feature is `experimental` until tested in real browsers.**
Nothing below is claimed from reading specs alone: the matrix states what
each browser's Web Speech API actually does, and every gap is labeled.
Rule (same as `LANGUAGE_SUPPORT.md`): never present weak/unverified voice
support as working — it is text-only, experimental, or blocked.

No paid STT/TTS services, no API keys. Voice is a client-side enhancement
layer: the text interview works identically with voice unavailable.

## Browser × capability matrix

`supported` = the API exists and works · `experimental` = exists but
untested by us or varies by device · `unsupported` = the API does not exist.

| Browser | Speech input (STT, mic) | Read-aloud (TTS) | Why |
| ------- | ----------------------- | ---------------- | --- |
| Chrome (desktop) | `supported`¹ | `supported`² | ¹STT via Google servers — needs internet; audio leaves the device (see Privacy). ²TTS via OS voices + Google voices |
| Edge (desktop) | `supported`¹ | `supported`² | Chromium-based; same behavior as Chrome |
| Firefox (desktop) | `unsupported` | `supported` | Firefox never implemented the SpeechRecognition API; `speechSynthesis` works with OS voices |
| Safari (desktop) | `unsupported` | `supported` | WebKit has no SpeechRecognition; `speechSynthesis` uses macOS voices |
| Chrome (Android) | `experimental` | `experimental` | STT generally works; TTS voice availability varies by device — not tested by us |
| Safari (iOS) | `unsupported` | `supported` | No STT API on iOS at all; TTS works |

## Language × capability matrix

The app maps language codes to BCP-47 tags for the browser APIs
(`client/src/lib/voice.ts` `recognitionLangFor`).

| Language | Speech input | Read-aloud |
| -------- | ------------ | ---------- |
| English (`en` → `en-US`) | `supported` where the browser supports STT | `supported` where an English voice is installed (most systems ship one) |
| Urdu (`ur` → `ur-PK`) | `experimental` — Chrome has an `ur-PK` recognition model, but we have not tested it end-to-end; accuracy unknown | `experimental` — only if an Urdu voice is installed in the OS/browser; most systems have none, and the UI says so instead of pretending |
| Roman Urdu (`roman-ur` → `ur-PK` model) | `experimental` — **no browser on earth ships a Roman-Urdu speech model.** Recognition uses the Urdu model, so the transcript will likely come back in Urdu script or mis-hear. The transcript is always editable: fix it before submitting. This mismatch is shown in the UI, not hidden. | `experimental` — spoken through the Urdu voice if one is installed; an Urdu-script voice reading Roman-Urdu text is best-effort pronunciation |
| Punjabi Roman / Pashto / Sindhi / Saraiki / Balochi | `unsupported` as STT targets — the recognizer falls back to `en-US` and says so; answers are always accepted as typed text | `unsupported` — read-aloud is English/Urdu-only; no voice is ever faked |

## What the UI promises (and nothing more)

1. **🔊 Listen** reads the question aloud in the session's interview
   language — or says plainly why it can't ("No Urdu voice installed in
   this browser — showing text").
2. **🎤 Speak answer** dictates into the answer box. Interim results show
   as a "Hearing: …" preview; only final results are committed — into the
   same textarea, which stays editable. Correcting the transcript before
   submitting is required behavior, not a nice-to-have.
3. Every failure names itself in plain language: microphone blocked →
   "type your answer instead"; no STT in this browser → "typing works
   fine"; nothing heard → "try again, or type".
4. A **"Voice: experimental"** badge sits next to the question badge on
   every interview screen, and `/settings/languages` has a read-only
   diagnostics panel (capabilities + installed en/ur voices). No fake
   toggles: there is nothing to switch on.

## Privacy

In Chrome/Edge, speech recognition sends your audio to the provider's
servers for transcription — it does not happen on-device. If that matters
for an answer, type it instead. We store only the final transcript text
you submit, never audio.

## What "experimental" honestly means here

Voice *input* for Urdu/Roman Urdu and *read-aloud* in Urdu are the two
capabilities most likely to disappoint: the first depends on an untested
recognition model, the second on a voice most users don't have installed.
We built the UI to degrade to text gracefully in both cases and labeled
everything accordingly. Promoting any cell above `experimental` requires a
real-browser test recorded in `TESTING.md`.
