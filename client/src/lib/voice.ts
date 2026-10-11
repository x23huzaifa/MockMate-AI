/**
 * Voice provider abstraction (Phase E) — browser Web Speech API only.
 *
 * No paid STT/TTS services, no API keys, zero new npm dependencies.
 * The whole feature is EXPERIMENTAL until tested in real browsers —
 * see VOICE_SUPPORT.md for the honest capability matrix.
 *
 * Design rules (non-negotiable):
 * 1. Capabilities are feature-detected, never assumed.
 * 2. getBestVoice() returns null when no voice matches the requested
 *    language — it NEVER silently substitutes an English voice and
 *    lets the UI claim Urdu speech.
 * 3. Every failure surfaces as a typed VoiceError with a plain-language
 *    message — errors are never swallowed, and text always keeps working.
 * 4. All browser access goes through injectable fakes so this module is
 *    unit-testable without jsdom (vitest runs in node here).
 */

export type VoiceErrorCode =
  | "no-tts"
  | "no-voice-for-lang"
  | "speak-interrupted"
  | "no-stt"
  | "mic-denied"
  | "no-speech"
  | "stt-error";

export class VoiceError extends Error {
  readonly code: VoiceErrorCode;
  /** false = needs a browser/OS change (not retryable); true = user can retry. */
  readonly recoverable: boolean;

  constructor(code: VoiceErrorCode, message: string, recoverable: boolean) {
    super(message);
    this.name = "VoiceError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

export interface VoiceCapabilities {
  sttSupported: boolean;
  ttsSupported: boolean;
  sttNote: string;
  ttsNote: string;
}

/** Minimal structural shape of a speech-synthesis voice. */
export interface VoiceLike {
  lang: string;
  name: string;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  lang: string;
  voice: VoiceLike | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export interface SpeechSynthesisLike {
  getVoices(): VoiceLike[];
  speak(utterance: SpeechSynthesisUtteranceLike): void;
  cancel(): void;
  /** Subscribe to async voice-list loading (Chrome populates voices late). */
  setOnVoicesChanged(cb: (() => void) | null): void;
}

export interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}

export interface RecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResultLike>;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** Injectable browser surface. Defaults read the real window. */
export interface WindowLike {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  speechSynthesis?: unknown;
}

export function defaultWindowLike(): WindowLike {
  if (typeof window === "undefined") return {};
  return window as unknown as WindowLike;
}

function asSpeechSynthesis(value: unknown): SpeechSynthesisLike | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const s = value as {
    getVoices?: unknown;
    speak?: unknown;
    cancel?: unknown;
  };
  if (
    typeof s.getVoices !== "function" ||
    typeof s.speak !== "function" ||
    typeof s.cancel !== "function"
  ) {
    return undefined;
  }
  // Adapt the real DOM object to our structural interface (bivariance
  // would otherwise fight strictFunctionTypes on onvoiceschanged).
  const dom = s as {
    getVoices(): { lang: string; name: string }[];
    speak(u: unknown): void;
    cancel(): void;
    onvoiceschanged: ((() => void) | null);
  };
  return {
    getVoices: () => dom.getVoices().map((v) => ({ lang: v.lang, name: v.name })),
    speak: (u) => dom.speak(u),
    cancel: () => dom.cancel(),
    setOnVoicesChanged: (cb) => {
      dom.onvoiceschanged = cb;
    },
  };
}

function recognitionCtor(
  windowLike: WindowLike
): (new () => SpeechRecognitionLike) | undefined {
  const ctor = windowLike.SpeechRecognition ?? windowLike.webkitSpeechRecognition;
  return typeof ctor === "function"
    ? (ctor as new () => SpeechRecognitionLike)
    : undefined;
}

/**
 * Feature-detect speech capabilities. Notes are deliberately blunt:
 * the UI shows them verbatim so users know exactly what to expect.
 */
export function getVoiceCapabilities(
  windowLike: WindowLike = defaultWindowLike()
): VoiceCapabilities {
  const sttSupported = recognitionCtor(windowLike) !== undefined;
  const ttsSupported = asSpeechSynthesis(windowLike.speechSynthesis) !== undefined;
  return {
    sttSupported,
    ttsSupported,
    sttNote: sttSupported
      ? "Speech recognition works in Chrome and Edge on desktop (it sends audio to the provider's servers, so it needs internet). Firefox and Safari do not support the Web Speech recognition API at all."
      : "Voice input isn't supported in this browser — Firefox and Safari don't have the Web Speech recognition API. Typing works fine.",
    ttsNote: ttsSupported
      ? "Read-aloud is available, but only for languages with a voice installed in your OS/browser. Most systems ship English voices only — Urdu almost always needs a voice installed first (see diagnostics below)."
      : "This browser cannot speak text aloud. Questions are shown as text.",
  };
}

const VOICE_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  "roman-ur": "Roman Urdu",
};

export function voiceLanguageLabel(code: string): string {
  return VOICE_LANGUAGE_LABELS[code] ?? code;
}

export interface RecognitionLangMapping {
  /** BCP-47 tag handed to the browser recognizer. */
  bcp47: string;
  /** Non-null when the mapping is approximate — the UI should show this. */
  note: string | null;
}

/**
 * Map an app language code to the BCP-47 tag the browser speech APIs want.
 * Honest about the gaps: no browser on earth ships a Roman-Urdu speech
 * model, so roman-ur uses the Urdu (ur-PK) model and the transcript stays
 * editable so the user can fix whatever the model mangles.
 */
export function recognitionLangFor(code: string): RecognitionLangMapping {
  if (code === "en") return { bcp47: "en-US", note: null };
  if (code === "ur") return { bcp47: "ur-PK", note: null };
  if (code === "roman-ur") {
    return {
      bcp47: "ur-PK",
      note: "Browsers have no Roman-Urdu speech model — recognition uses the Urdu (ur-PK) model, so the transcript may come back in Urdu script or mis-hear. It stays editable: fix it before submitting.",
    };
  }
  return {
    bcp47: "en-US",
    note: `No speech model mapped for "${code}" — using English (US). Type your answer for full fidelity.`,
  };
}

/**
 * Pick the best installed voice for a language code. Matches on BCP-47
 * prefix (ur-PK target matches an installed ur-PK or ur-IN voice).
 * Returns null when nothing matches — the caller must say so plainly,
 * never fall back to an English voice and pretend it is Urdu.
 */
export function getBestVoice(
  code: string,
  voices: readonly VoiceLike[]
): VoiceLike | null {
  const mapping = recognitionLangFor(code);
  const target = mapping.bcp47.toLowerCase();
  const prefix = target.split("-")[0];
  const startsWithPrefix = (lang: string) =>
    lang.toLowerCase() === target || lang.toLowerCase().startsWith(prefix + "-");
  // Prefer an exact BCP-47 match, then any same-language voice.
  const exact = voices.find((v) => v.lang.toLowerCase() === target);
  if (exact) return exact;
  return voices.find((v) => startsWithPrefix(v.lang)) ?? null;
}

/** Voices for English/Urdu only — used by the diagnostics section. */
export function filterRelevantVoices(voices: readonly VoiceLike[]): VoiceLike[] {
  return voices.filter((v) => {
    const l = v.lang.toLowerCase();
    return l === "en" || l.startsWith("en-") || l === "ur" || l.startsWith("ur-");
  });
}

async function loadVoices(synth: SpeechSynthesisLike): Promise<VoiceLike[]> {
  const first = synth.getVoices();
  if (first.length > 0) return first;
  // Chrome populates voices asynchronously — wait briefly, then accept
  // whatever we have (possibly empty: honestly "no voices").
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      synth.setOnVoicesChanged(null);
      resolve(synth.getVoices());
    }, 2000);
    synth.setOnVoicesChanged(() => {
      clearTimeout(timer);
      synth.setOnVoicesChanged(null);
      resolve(synth.getVoices());
    });
  });
}

/** All installed voices (waits briefly for Chrome's async voice loading). */
export async function getInstalledVoices(
  windowLike: WindowLike = defaultWindowLike()
): Promise<VoiceLike[]> {
  const synth = asSpeechSynthesis(windowLike.speechSynthesis);
  if (!synth) return [];
  return loadVoices(synth);
}

export interface SpeakDeps {
  speechSynthesis?: SpeechSynthesisLike;
  createUtterance?: () => SpeechSynthesisUtteranceLike;
  windowLike?: WindowLike;
}

function defaultCreateUtterance(): SpeechSynthesisUtteranceLike {
  // SpeechSynthesisUtterance exists in the DOM lib; recognition types don't,
  // which is why the rest of this module uses structural interfaces.
  // Cast: the DOM onend/onerror signatures are wider than the Like interface.
  return new SpeechSynthesisUtterance() as unknown as SpeechSynthesisUtteranceLike;
}

/**
 * Speak text in the given app language. Resolves when the utterance ends.
 * Rejects with VoiceError: no-tts | no-voice-for-lang | speak-interrupted.
 */
export async function speak(
  text: string,
  lang: string,
  deps: SpeakDeps = {}
): Promise<void> {
  const windowLike = deps.windowLike ?? defaultWindowLike();
  const synth =
    deps.speechSynthesis ?? asSpeechSynthesis(windowLike.speechSynthesis);
  if (!synth) {
    throw new VoiceError(
      "no-tts",
      "This browser can't speak text aloud. The question is shown as text.",
      false
    );
  }
  const voices = await loadVoices(synth);
  const voice = getBestVoice(lang, voices);
  if (!voice) {
    const label = voiceLanguageLabel(lang);
    throw new VoiceError(
      "no-voice-for-lang",
      `No ${label} voice is installed in this browser — showing the question as text. (Install a ${label} voice in your OS/browser language settings to enable read-aloud.)`,
      false
    );
  }
  // Stop any in-flight speech so re-clicks don't overlap.
  synth.cancel();
  const utterance = deps.createUtterance
    ? deps.createUtterance()
    : defaultCreateUtterance();
  utterance.text = text;
  utterance.lang = recognitionLangFor(lang).bcp47;
  utterance.voice = voice;
  return new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () =>
      reject(
        new VoiceError(
          "speak-interrupted",
          "Read-aloud was interrupted.",
          true
        )
      );
    synth.speak(utterance);
  });
}

/** Best-effort stop for cleanup (unmount / question change). Never throws. */
export function cancelSpeech(windowLike: WindowLike = defaultWindowLike()): void {
  try {
    asSpeechSynthesis(windowLike.speechSynthesis)?.cancel();
  } catch {
    /* cleanup path — nothing to report */
  }
}

export interface RecognizerCallbacks {
  /** Called per result; interim calls are previews, final calls are commits. */
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (err: VoiceError) => void;
  onEnd: () => void;
}

export interface RecognizerHandle {
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognizerDeps {
  windowLike?: WindowLike;
  RecognitionCtor?: new () => SpeechRecognitionLike;
}

function mapRecognitionError(browserError: string): VoiceError {
  switch (browserError) {
    case "not-allowed":
    case "service-not-allowed":
      return new VoiceError(
        "mic-denied",
        "Microphone blocked — type your answer instead. (Allow microphone access in the browser address bar to use voice input.)",
        true
      );
    case "no-speech":
      return new VoiceError(
        "no-speech",
        "Didn't hear anything — try again, or type your answer.",
        true
      );
    case "audio-capture":
      return new VoiceError(
        "stt-error",
        "No microphone found — type your answer instead.",
        true
      );
    case "network":
      return new VoiceError(
        "stt-error",
        "Speech recognition needs an internet connection — type your answer instead.",
        true
      );
    default:
      return new VoiceError(
        "stt-error",
        "Voice input hit an error — your typed text is safe; type or try again.",
        true
      );
  }
}

/**
 * Create a speech recognizer for the given app language. Interim results
 * stream as editable previews; only final results should be committed to
 * the answer (the UI owns that policy). If the browser has no recognizer,
 * start() reports a no-stt VoiceError instead of throwing.
 */
export function createRecognizer(
  lang: string,
  callbacks: RecognizerCallbacks,
  deps: RecognizerDeps = {}
): RecognizerHandle {
  const windowLike = deps.windowLike ?? defaultWindowLike();
  const Ctor = deps.RecognitionCtor ?? recognitionCtor(windowLike);
  const mapping = recognitionLangFor(lang);

  if (!Ctor) {
    return {
      start: () =>
        callbacks.onError(
          new VoiceError(
            "no-stt",
            "Voice input isn't supported in this browser — typing works fine.",
            false
          )
        ),
      stop: () => undefined,
      abort: () => undefined,
    };
  }

  const rec: SpeechRecognitionLike = new Ctor();
  rec.lang = mapping.bcp47;
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (event: RecognitionEventLike) => {
    const results = event.results;
    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0]?.transcript ?? "";
      if (transcript) callbacks.onResult(transcript, result.isFinal);
    }
  };
  rec.onerror = (event: { error: string }) => {
    if (event.error === "aborted") {
      callbacks.onEnd();
      return;
    }
    callbacks.onError(mapRecognitionError(event.error));
  };
  rec.onend = () => callbacks.onEnd();

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* cleanup path */
      }
    },
  };
}
