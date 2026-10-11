/**
 * Unit tests for client/src/lib/voice.ts (Phase E).
 *
 * No jsdom here (vitest runs in node) — every browser API is injected
 * through the module's deps parameters, so these tests exercise the real
 * logic (capability detection, language mapping, voice matching, error
 * mapping) against fakes.
 */
import { describe, expect, it } from "vitest";
import {
  VoiceError,
  createRecognizer,
  filterRelevantVoices,
  getBestVoice,
  getVoiceCapabilities,
  recognitionLangFor,
  speak,
  voiceLanguageLabel,
  type RecognitionEventLike,
  type SpeechRecognitionLike,
  type SpeechSynthesisLike,
  type SpeechSynthesisUtteranceLike,
  type VoiceLike,
  type WindowLike,
} from "./voice";

const EN_VOICE: VoiceLike = { lang: "en-US", name: "English (US)" };
const UR_VOICE: VoiceLike = { lang: "ur-PK", name: "Urdu (Pakistan)" };

class FakeUtterance implements SpeechSynthesisUtteranceLike {
  text = "";
  lang = "";
  voice: VoiceLike | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

function fakeSynth(voices: VoiceLike[]): SpeechSynthesisLike {
  return {
    getVoices: () => voices,
    speak: (u) => {
      // Immediately finish successfully, like a real onend.
      u.onend?.();
    },
    cancel: () => undefined,
    setOnVoicesChanged: () => undefined,
  };
}

function fakeResultEvent(
  parts: { text: string; isFinal: boolean }[]
): RecognitionEventLike {
  return {
    resultIndex: 0,
    results: parts.map((p) => ({
      isFinal: p.isFinal,
      length: 1,
      0: { transcript: p.text },
    })),
  };
}

class FakeRecognition implements SpeechRecognitionLike {
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((e: RecognitionEventLike) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
}

describe("getVoiceCapabilities", () => {
  it("detects STT via webkit prefix and TTS via speechSynthesis", () => {
    const caps = getVoiceCapabilities({
      webkitSpeechRecognition: FakeRecognition,
      speechSynthesis: fakeSynth([EN_VOICE]),
    } as unknown as WindowLike);
    expect(caps.sttSupported).toBe(true);
    expect(caps.ttsSupported).toBe(true);
  });

  it("reports unsupported with honest notes when APIs are absent", () => {
    const caps = getVoiceCapabilities({});
    expect(caps.sttSupported).toBe(false);
    expect(caps.ttsSupported).toBe(false);
    // Notes must name the actual gap, not hand-wave.
    expect(caps.sttNote).toMatch(/Firefox and Safari/);
    expect(caps.ttsNote).toMatch(/cannot speak text aloud/);
  });

  it("supported STT note is honest about server-side recognition", () => {
    const caps = getVoiceCapabilities({
      SpeechRecognition: FakeRecognition,
    } as unknown as WindowLike);
    expect(caps.sttSupported).toBe(true);
    expect(caps.sttNote).toMatch(/needs internet/);
  });
});

describe("recognitionLangFor", () => {
  it("maps en → en-US with no caveat", () => {
    expect(recognitionLangFor("en")).toEqual({ bcp47: "en-US", note: null });
  });

  it("maps ur → ur-PK with no caveat", () => {
    expect(recognitionLangFor("ur")).toEqual({ bcp47: "ur-PK", note: null });
  });

  it("maps roman-ur → ur-PK with a documented no-model caveat", () => {
    const m = recognitionLangFor("roman-ur");
    expect(m.bcp47).toBe("ur-PK");
    expect(m.note).toMatch(/no Roman-Urdu speech model/i);
    expect(m.note).toMatch(/editable/);
  });

  it("falls back to en-US with a note for unmapped codes", () => {
    const m = recognitionLangFor("ps");
    expect(m.bcp47).toBe("en-US");
    expect(m.note).toMatch(/"ps"/);
  });
});

describe("getBestVoice", () => {
  const voices = [EN_VOICE, UR_VOICE];

  it("returns the Urdu voice for ur", () => {
    expect(getBestVoice("ur", voices)).toBe(UR_VOICE);
  });

  it("prefers an exact BCP-47 match", () => {
    const urIn: VoiceLike = { lang: "ur-IN", name: "Urdu (India)" };
    expect(getBestVoice("ur", [urIn, UR_VOICE])).toBe(UR_VOICE);
  });

  it("matches on language prefix (ur-IN satisfies ur-PK target)", () => {
    const urIn: VoiceLike = { lang: "ur-IN", name: "Urdu (India)" };
    expect(getBestVoice("ur", [urIn])).toBe(urIn);
  });

  it("returns null — NOT an English voice — when no Urdu voice exists", () => {
    // This is the core honesty assertion: we must never let the UI claim
    // Urdu speech while an English voice reads the text.
    expect(getBestVoice("ur", [EN_VOICE])).toBeNull();
    expect(getBestVoice("roman-ur", [EN_VOICE])).toBeNull();
  });

  it("returns null for empty voice lists", () => {
    expect(getBestVoice("en", [])).toBeNull();
  });
});

describe("filterRelevantVoices", () => {
  it("keeps en/ur voices, drops the rest", () => {
    const de: VoiceLike = { lang: "de-DE", name: "Deutsch" };
    expect(filterRelevantVoices([EN_VOICE, UR_VOICE, de])).toEqual([
      EN_VOICE,
      UR_VOICE,
    ]);
  });
});

describe("voiceLanguageLabel", () => {
  it("labels known codes, passes through unknown ones", () => {
    expect(voiceLanguageLabel("ur")).toBe("Urdu");
    expect(voiceLanguageLabel("roman-ur")).toBe("Roman Urdu");
    expect(voiceLanguageLabel("ps")).toBe("ps");
  });
});

describe("speak", () => {
  it("rejects no-tts when the browser has no speechSynthesis", async () => {
    const err = await speak("hello", "en", {
      windowLike: {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceError);
    expect(err.code).toBe("no-tts");
    expect(err.recoverable).toBe(false);
  });

  it("rejects no-voice-for-lang (never silently uses English for Urdu)", async () => {
    const err = await speak("salam", "ur", {
      speechSynthesis: fakeSynth([EN_VOICE]),
      createUtterance: () => new FakeUtterance(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceError);
    expect(err.code).toBe("no-voice-for-lang");
    expect(err.message).toMatch(/No Urdu voice is installed/);
  });

  it("resolves when the utterance ends and sets text/lang/voice", async () => {
    const created: FakeUtterance[] = [];
    await speak("hello there", "en", {
      speechSynthesis: fakeSynth([EN_VOICE]),
      createUtterance: () => {
        const u = new FakeUtterance();
        created.push(u);
        return u;
      },
    });
    expect(created).toHaveLength(1);
    expect(created[0].text).toBe("hello there");
    expect(created[0].lang).toBe("en-US");
    expect(created[0].voice).toBe(EN_VOICE);
  });

  it("rejects speak-interrupted when the utterance errors", async () => {
    const err = await speak("hello", "en", {
      speechSynthesis: {
        ...fakeSynth([EN_VOICE]),
        speak: (u) => {
          u.onerror?.();
        },
      },
      createUtterance: () => new FakeUtterance(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceError);
    expect(err.code).toBe("speak-interrupted");
  });
});

describe("createRecognizer", () => {
  function makeCallbacks() {
    const seen: { transcript: string; isFinal: boolean }[] = [];
    const errors: VoiceError[] = [];
    let ended = 0;
    return {
      seen,
      errors,
      get ended() {
        return ended;
      },
      callbacks: {
        onResult: (transcript: string, isFinal: boolean) =>
          seen.push({ transcript, isFinal }),
        onError: (e: VoiceError) => errors.push(e),
        onEnd: () => {
          ended += 1;
        },
      },
    };
  }

  it("start() reports no-stt when the browser has no recognizer", () => {
    const bag = makeCallbacks();
    const rec = createRecognizer("en", bag.callbacks, { windowLike: {} });
    rec.start();
    expect(bag.errors).toHaveLength(1);
    expect(bag.errors[0].code).toBe("no-stt");
    expect(bag.errors[0].recoverable).toBe(false);
  });

  it("sets lang to ur-PK for ur and streams interim then final", () => {
    const bag = makeCallbacks();
    let instance: FakeRecognition | null = null;
    class Capturing extends FakeRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    const rec = createRecognizer("ur", bag.callbacks, {
      RecognitionCtor:
        Capturing as unknown as new () => SpeechRecognitionLike,
    });
    rec.start();
    expect(instance).not.toBeNull();
    expect(instance!.lang).toBe("ur-PK");
    expect(instance!.interimResults).toBe(true);
    instance!.onresult?.(
      fakeResultEvent([
        { text: "salam", isFinal: false },
        { text: "salam mera naam", isFinal: true },
      ])
    );
    expect(bag.seen).toEqual([
      { transcript: "salam", isFinal: false },
      { transcript: "salam mera naam", isFinal: true },
    ]);
  });

  it("maps not-allowed → mic-denied with a plain-language message", () => {
    const bag = makeCallbacks();
    let instance: FakeRecognition | null = null;
    class Capturing extends FakeRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    const rec = createRecognizer("en", bag.callbacks, {
      RecognitionCtor:
        Capturing as unknown as new () => SpeechRecognitionLike,
    });
    rec.start();
    instance!.onerror?.({ error: "not-allowed" });
    expect(bag.errors).toHaveLength(1);
    expect(bag.errors[0].code).toBe("mic-denied");
    expect(bag.errors[0].message).toMatch(/Microphone blocked/);
  });

  it("maps no-speech → no-speech and abort → onEnd without error", () => {
    const bag = makeCallbacks();
    let instance: FakeRecognition | null = null;
    class Capturing extends FakeRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    createRecognizer("en", bag.callbacks, {
      RecognitionCtor:
        Capturing as unknown as new () => SpeechRecognitionLike,
    }).start();
    instance!.onerror?.({ error: "no-speech" });
    expect(bag.errors[0].code).toBe("no-speech");
    instance!.onerror?.({ error: "aborted" });
    expect(bag.errors).toHaveLength(1);
    expect(bag.ended).toBe(1);
  });

  it("stop()/abort() delegate to the recognizer", () => {
    const bag = makeCallbacks();
    let instance: FakeRecognition | null = null;
    class Capturing extends FakeRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    const rec = createRecognizer("en", bag.callbacks, {
      RecognitionCtor:
        Capturing as unknown as new () => SpeechRecognitionLike,
    });
    rec.stop();
    expect(instance!.stopped).toBe(true);
    rec.abort();
    expect(instance!.aborted).toBe(true);
  });
});
