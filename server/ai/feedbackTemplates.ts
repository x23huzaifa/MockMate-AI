/**
 * Per-dimension feedback sentence templates (Phase D).
 *
 * Honesty contract: templates exist ONLY for "en", "ur", and "roman-ur".
 * `feedbackStringsFor()` returns English with a logged note for anything
 * else — never a silently machine-"translated" string we did not write.
 * Exact counts: 4 dimensions × (1 strength + 1 improvement) + summary +
 * closing note per language; see LANGUAGE_SUPPORT.md.
 */
import type { DimensionScores } from "./types.js";

export interface FeedbackStrings {
  summary: (overall: string, strong: string[], weak: string[]) => string;
  strength: Record<keyof DimensionScores, string>;
  improvement: Record<keyof DimensionScores, string>;
  dimensionLabel: Record<keyof DimensionScores, string>;
  honestyNote: string;
}

const EN: FeedbackStrings = {
  summary: (overall, strong, weak) => {
    const parts = [
      `Overall ${overall} out of 5 across relevance, depth, clarity, and structure.`,
    ];
    if (strong.length > 0) parts.push(`Strongest areas: ${strong.join(", ")}.`);
    if (weak.length > 0) {
      parts.push(`To improve (${weak.join(", ")}): see below.`);
    } else {
      parts.push("Solid answer — keep practicing to stay consistent under pressure.");
    }
    return parts.join(" ");
  },
  strength: {
    relevance: "Stayed relevant to the question asked.",
    depth: "Good depth with specific details.",
    clarity: "Clear, easy-to-follow sentences.",
    structure: "Well-structured answer with a beginning, middle, and end.",
  },
  improvement: {
    relevance:
      "Address the question more directly — pick out its key terms and make sure your answer covers each of them.",
    depth:
      "Add more depth: a concrete example, a number, or a specific situation you have faced.",
    clarity: "Break the answer into shorter sentences so each idea lands clearly.",
    structure:
      "Give the answer a simple shape: a one-line opening, the main points in the middle, and a closing line.",
  },
  dimensionLabel: {
    relevance: "relevance",
    depth: "depth",
    clarity: "clarity",
    structure: "structure",
  },
  honestyNote:
    "Note: this is an automated heuristic evaluation, not human judgment. Treat it as practice feedback.",
};

const UR: FeedbackStrings = {
  summary: (overall, strong, weak) => {
    const parts = [
      `مجموعی اسکور 5 میں سے ${overall} رہا — مطابقت، گہرائی، وضاحت اور ترتیب کے اعتبار سے۔`,
    ];
    if (strong.length > 0)
      parts.push(`مضبوط پہلو: ${strong.join("، ")}۔`);
    if (weak.length > 0) {
      parts.push(`بہتری کے پہلو (${weak.join("، ")}): نیچے دیکھیں۔`);
    } else {
      parts.push("اچھا جواب — دباؤ میں مستقل مزاجی کے لیے مشق جاری رکھیں۔");
    }
    return parts.join(" ");
  },
  strength: {
    relevance: "سوال سے مطابقت اچھی رہی۔",
    depth: "تفصیل اور گہرائی مناسب تھی۔",
    clarity: "جملے واضح اور آسان تھے۔",
    structure: "جواب کی ترتیب بہتر تھی — آغاز، درمیان اور اختتام۔",
  },
  improvement: {
    relevance:
      "سوال کے اہم الفاظ کو براہِ راست جواب دیں — یقینی بنائیں کہ آپ کا جواب ہر نکتے کا احاطہ کرے۔",
    depth:
      "مزید گہرائی شامل کریں: کوئی ٹھوس مثال، عدد، یا پیش آمدہ صورتحال۔",
    clarity: "جواب کو چھوٹے جملوں میں تقسیم کریں تاکہ ہر خیال واضح ہو۔",
    structure:
      "جواب کی سادہ شکل بنائیں: ایک ابتدائی جملہ، درمیان میں اہم نکات، اور ایک اختتامی جملہ۔",
  },
  dimensionLabel: {
    relevance: "مطابقت",
    depth: "گہرائی",
    clarity: "وضاحت",
    structure: "ترتیب",
  },
  honestyNote:
    "نوٹ: یہ خودکار تخمینی جائزہ ہے، انسانی فیصلہ نہیں۔ اسے مشقی آراء سمجھیں۔",
};

const ROMAN_UR: FeedbackStrings = {
  summary: (overall, strong, weak) => {
    const parts = [
      `Overall score 5 mein se ${overall} raha — relevance, depth, clarity aur structure ke hisaab se.`,
    ];
    if (strong.length > 0)
      parts.push(`Mazboot pehlu: ${strong.join(", ")}.`);
    if (weak.length > 0) {
      parts.push(`Behtri ke pehlu (${weak.join(", ")}): neechay dekhein.`);
    } else {
      parts.push("Acha jawab — pressure mein consistent rehnay ke liye practice jari rakhein.");
    }
    return parts.join(" ");
  },
  strength: {
    relevance: "Sawal se relevance achi rahi.",
    depth: "Detail aur gehrai munasib thi.",
    clarity: "Jumlay wazeh aur aasaan thay.",
    structure: "Jawab ki tarteeb behtar thi — aghaz, darmiyan aur ikhtatam.",
  },
  improvement: {
    relevance:
      "Sawal ke ahem alfaaz ka seedha jawab dein — yaqeeni banayein ke aap ka jawab har nuqtay ka ihata karay.",
    depth:
      "Mazeed gehrai shamil karein: koi thoos misaal, number, ya pesh aamada surat-e-haal.",
    clarity:
      "Jawab ko chhotay jumlon mein taqseem karein taake har khayal wazeh ho.",
    structure:
      "Jawab ki saada shakal banayein: aik ibtedai jumla, darmiyan mein ahem nukaat, aur aik ikhtatami jumla.",
  },
  dimensionLabel: {
    relevance: "relevance",
    depth: "depth",
    clarity: "clarity",
    structure: "structure",
  },
  honestyNote:
    "Note: ye automated takhmeeni jaiza hai, insani faisla nahi. Isay practice feedback samjhein.",
};

const TEMPLATES: Record<string, FeedbackStrings> = {
  en: EN,
  ur: UR,
  "roman-ur": ROMAN_UR,
};

/**
 * Returns the feedback strings for a language, falling back to English
 * with a logged note when templates do not exist. The fallback is never
 * silent: callers (and server logs) can see it happened.
 */
export function feedbackStringsFor(lang: string | undefined): {
  strings: FeedbackStrings;
  usedFallback: boolean;
} {
  const key = typeof lang === "string" ? lang : "en";
  const found = TEMPLATES[key];
  if (found) return { strings: found, usedFallback: false };
  console.warn(
    `[feedbackTemplates] No feedback templates for "${key}" — falling back to English.`
  );
  return { strings: EN, usedFallback: true };
}

/** Languages with hand-written templates (the honest allowlist). */
export const FEEDBACK_TEMPLATE_LANGUAGES = Object.keys(TEMPLATES);
