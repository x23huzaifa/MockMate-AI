/**
 * Template-based question provider + heuristic answer evaluator.
 *
 * HONESTY LABEL: this is NOT artificial intelligence. Questions come from a
 * fixed local bank (40 English entries + 10 Urdu-script + 10 Roman-Urdu,
 * hand-written and exactly counted — see LANGUAGE_SUPPORT.md); selection is
 * deterministic (seeded — the same input always yields the same questions,
 * no randomness). Answer evaluation is a transparent rubric heuristic
 * (keyword overlap, length bands, sentence shape, structure markers) with
 * per-language stopwords/keyword lists where they exist (Phase D). It
 * approximates interview coaching signals; it is not human judgment. The UI
 * labels this "Template-based questions (beta)" and every report carries
 * the note.
 *
 * The provider interfaces (server/ai/types.ts) let a real LLM replace this
 * file later without touching any call site.
 */
import type {
  AnalyzeCVInput,
  AnalyzeCVResult,
  AnswerEvaluator,
  BuildCVSectionInput,
  BuildCVSectionResult,
  DimensionScores,
  EvaluationInput,
  EvaluationResult,
  GeneratedQuestion,
  GenerateSkillPlanInput,
  GenerateSkillPlanResult,
  HealthCheckResult,
  QuestionCategory,
  QuestionGenerationInput,
  QuestionProvider,
} from "./types.js";
import { feedbackStringsFor } from "./feedbackTemplates.js";
import { AINotSupportedError } from "./errors.js";

interface BankEntry {
  id: number;
  category: QuestionCategory;
  text: string;
  rubricHints: string[];
  /** Lowercase keywords used to match the question to a role/skills. */
  roleKeywords: string[];
}

const QUESTION_BANK: BankEntry[] = [
  // --- introduction (5) ---
  { id: 1, category: "introduction", text: "Tell me about yourself and walk me through your background.", rubricHints: ["relevant experience", "career progression", "concise summary"], roleKeywords: [] },
  { id: 2, category: "introduction", text: "Why are you interested in this role?", rubricHints: ["motivation", "role knowledge", "company fit"], roleKeywords: [] },
  { id: 3, category: "introduction", text: "What are your greatest strengths as a professional?", rubricHints: ["self-awareness", "relevant strengths", "concrete examples"], roleKeywords: [] },
  { id: 4, category: "introduction", text: "Where do you see yourself in the next two to three years?", rubricHints: ["ambition", "realism", "alignment with role"], roleKeywords: [] },
  { id: 5, category: "introduction", text: "What do you know about our company and this position?", rubricHints: ["research", "role understanding", "genuine interest"], roleKeywords: [] },

  // --- technical (15) ---
  { id: 11, category: "technical", text: "Explain the difference between let, const, and var in JavaScript, and when you would use each.", rubricHints: ["scope", "hoisting", "reassignment rules", "best practices"], roleKeywords: ["javascript", "js", "frontend", "web", "react", "node"] },
  { id: 12, category: "technical", text: "How does React's virtual DOM work, and why does it improve performance?", rubricHints: ["reconciliation", "diffing", "rendering", "performance"], roleKeywords: ["react", "frontend", "javascript", "web"] },
  { id: 13, category: "technical", text: "Describe how you would design a REST API endpoint, including status codes and error handling.", rubricHints: ["resource naming", "http verbs", "status codes", "error format"], roleKeywords: ["api", "backend", "rest", "node", "express", "web"] },
  { id: 14, category: "technical", text: "What is the difference between SQL and NoSQL databases, and how do you choose between them?", rubricHints: ["data model", "consistency", "scaling", "use cases"], roleKeywords: ["sql", "database", "backend", "mysql", "postgres", "mongodb", "data"] },
  { id: 15, category: "technical", text: "Explain how async/await works in JavaScript and how you handle errors in asynchronous code.", rubricHints: ["promises", "event loop", "try/catch", "error propagation"], roleKeywords: ["javascript", "node", "backend", "async", "js"] },
  { id: 16, category: "technical", text: "How would you optimize a slow database query?", rubricHints: ["indexing", "query plan", "n+1 problem", "caching"], roleKeywords: ["sql", "database", "backend", "mysql", "performance"] },
  { id: 17, category: "technical", text: "What is the purpose of version control, and describe your typical Git workflow.", rubricHints: ["branching", "commits", "pull requests", "merging"], roleKeywords: ["git", "devops", "collaboration", "software"] },
  { id: 18, category: "technical", text: "Explain the concept of closures in JavaScript with an example.", rubricHints: ["lexical scope", "example", "practical use"], roleKeywords: ["javascript", "frontend", "web", "js"] },
  { id: 19, category: "technical", text: "How do you ensure the security of a web application? Name three common vulnerabilities and how to prevent them.", rubricHints: ["xss", "csrf", "sql injection", "authentication"], roleKeywords: ["security", "web", "backend", "fullstack"] },
  { id: 20, category: "technical", text: "Describe the Python data structures you know and when you would use a dictionary versus a list.", rubricHints: ["list", "dict", "set", "time complexity"], roleKeywords: ["python", "backend", "data"] },
  { id: 21, category: "technical", text: "What is object-oriented programming? Explain encapsulation, inheritance, and polymorphism with examples.", rubricHints: ["definitions", "examples", "when to use"], roleKeywords: ["oop", "java", "python", "c++", "software"] },
  { id: 22, category: "technical", text: "How would you test a function that processes user payments? What kinds of tests would you write?", rubricHints: ["unit tests", "integration tests", "edge cases", "mocking"], roleKeywords: ["testing", "qa", "backend", "software"] },
  { id: 23, category: "technical", text: "Explain what a database index is and its trade-offs.", rubricHints: ["b-tree", "read vs write speed", "storage cost"], roleKeywords: ["sql", "database", "mysql", "backend"] },
  { id: 24, category: "technical", text: "What is the difference between TCP and UDP, and when would you use each?", rubricHints: ["reliability", "ordering", "latency", "use cases"], roleKeywords: ["networking", "backend", "devops", "systems"] },
  { id: 25, category: "technical", text: "How does CSS specificity work? How would you debug a style that is not applying?", rubricHints: ["specificity rules", "devtools", "cascade"], roleKeywords: ["css", "frontend", "web", "react"] },

  // --- behavioral (10) ---
  { id: 31, category: "behavioral", text: "Tell me about a time you worked through a disagreement with a teammate.", rubricHints: ["situation", "communication", "resolution", "outcome"], roleKeywords: [] },
  { id: 32, category: "behavioral", text: "Describe a challenging deadline you faced and how you handled it.", rubricHints: ["prioritization", "planning", "result"], roleKeywords: [] },
  { id: 33, category: "behavioral", text: "Tell me about a mistake you made at work or university and what you learned from it.", rubricHints: ["ownership", "reflection", "corrective action"], roleKeywords: [] },
  { id: 34, category: "behavioral", text: "Give an example of a time you had to learn something completely new very quickly.", rubricHints: ["learning approach", "resourcefulness", "outcome"], roleKeywords: [] },
  { id: 35, category: "behavioral", text: "Describe a situation where you took initiative without being asked.", rubricHints: ["proactivity", "impact", "ownership"], roleKeywords: [] },
  { id: 36, category: "behavioral", text: "Tell me about a time you received difficult feedback. How did you respond?", rubricHints: ["openness", "action taken", "growth"], roleKeywords: [] },
  { id: 37, category: "behavioral", text: "Have you ever led a team or a project? What was your approach?", rubricHints: ["leadership style", "delegation", "results"], roleKeywords: [] },
  { id: 38, category: "behavioral", text: "Describe a time you had to explain a technical concept to a non-technical person.", rubricHints: ["clarity", "empathy", "simplification"], roleKeywords: [] },
  { id: 39, category: "behavioral", text: "Tell me about a project you are most proud of and why.", rubricHints: ["contribution", "challenges", "measurable impact"], roleKeywords: [] },
  { id: 40, category: "behavioral", text: "How do you handle working under pressure? Give an example.", rubricHints: ["coping strategies", "example", "composure"], roleKeywords: [] },

  // --- situational (10) ---
  { id: 51, category: "situational", text: "If you joined tomorrow, what would you focus on in your first 30 days?", rubricHints: ["onboarding plan", "priorities", "learning"], roleKeywords: [] },
  { id: 52, category: "situational", text: "Your production deployment fails on a Friday evening. Walk me through your response.", rubricHints: ["triage", "communication", "rollback", "postmortem"], roleKeywords: [] },
  { id: 53, category: "situational", text: "A client asks for a feature that you believe is a bad idea. What do you do?", rubricHints: ["listening", "alternatives", "diplomacy"], roleKeywords: [] },
  { id: 54, category: "situational", text: "You discover a critical bug in code a senior colleague wrote. How do you handle it?", rubricHints: ["tact", "verification", "collaboration"], roleKeywords: [] },
  { id: 55, category: "situational", text: "How would you estimate the time needed for a feature you have never built before?", rubricHints: ["breakdown", "unknowns", "buffers", "communication"], roleKeywords: [] },
  { id: 56, category: "situational", text: "Two team members disagree on a technical approach and both ask for your opinion. What do you do?", rubricHints: ["neutrality", "criteria", "decision process"], roleKeywords: [] },
  { id: 57, category: "situational", text: "Your manager assigns you a task with an impossible deadline. How do you respond?", rubricHints: ["clarification", "negotiation", "prioritization"], roleKeywords: [] },
  { id: 58, category: "situational", text: "How would you onboard a new junior developer joining your team?", rubricHints: ["mentoring", "documentation", "gradual responsibility"], roleKeywords: [] },
  { id: 59, category: "situational", text: "A key requirement changes halfway through a sprint. What is your approach?", rubricHints: ["adaptability", "re-planning", "stakeholder communication"], roleKeywords: [] },
  { id: 60, category: "situational", text: "How do you decide what to work on when everything feels urgent?", rubricHints: ["prioritization framework", "impact", "communication"], roleKeywords: [] },
];

// ---------------------------------------------------------------------------
// Phase D — localized question banks (Pakistan-first).
//
// HONEST COUNT: exactly 10 Urdu-script + 10 Roman-Urdu questions
// (5 introduction + 5 behavioral each), hand-written — not translated by a
// model. Technical questions stay English-only for now (documented in
// LANGUAGE_SUPPORT.md); situational has no localized variants yet and falls
// back to English. Counts are asserted in server/ai/multilingual.test.ts.
// ---------------------------------------------------------------------------

const URDU_QUESTION_BANK: BankEntry[] = [
  // --- introduction (5) ---
  { id: 101, category: "introduction", text: "اپنے بارے میں بتائیں اور اپنے پس منظر کا خلاصہ پیش کریں۔", rubricHints: ["متعلقہ تجربہ", "کیریئر کی پیش رفت", "مختصر خلاصہ"], roleKeywords: [] },
  { id: 102, category: "introduction", text: "آپ اس کردار میں کیوں دلچسپی رکھتے ہیں؟", rubricHints: ["حوصلہ افزائی", "کردار کا علم", "کمپنی سے مطابقت"], roleKeywords: [] },
  { id: 103, category: "introduction", text: "ایک پیشہ ور کے طور پر آپ کی سب سے بڑی خوبیاں کیا ہیں؟", rubricHints: ["خود آگاہی", "متعلقہ خوبیاں", "ٹھوس مثالیں"], roleKeywords: [] },
  { id: 104, category: "introduction", text: "آپ خود کو اگلے دو سے تین سال میں کہاں دیکھتے ہیں؟", rubricHints: ["عزائم", "حقیقت پسندی", "کردار سے ہم آہنگی"], roleKeywords: [] },
  { id: 105, category: "introduction", text: "آپ ہماری کمپنی اور اس عہدے کے بارے میں کیا جانتے ہیں؟", rubricHints: ["تحقیق", "کردار کی سمجھ", "حقیقی دلچسپی"], roleKeywords: [] },
  // --- behavioral (5) ---
  { id: 111, category: "behavioral", text: "کسی ساتھی کے ساتھ اختلاف کا کوئی واقعہ بتائیں اور آپ نے اسے کیسے حل کیا۔", rubricHints: ["صورتحال", "بات چیت", "حل", "نتیجہ"], roleKeywords: [] },
  { id: 112, category: "behavioral", text: "کسی مشکل ڈیڈلائن کا سامنا کیسے کیا؟ تفصیل بتائیں۔", rubricHints: ["ترجیحات", "منصوبہ بندی", "نتیجہ"], roleKeywords: [] },
  { id: 113, category: "behavioral", text: "کام یا یونیورسٹی میں کی گئی کسی غلطی اور اس سے سیکھے گئے سبق کے بارے میں بتائیں۔", rubricHints: ["ذمہ داری", "غور و فکر", "اصلاحی اقدام"], roleKeywords: [] },
  { id: 114, category: "behavioral", text: "کوئی ایسا وقت بتائیں جب آپ نے بہت جلدی کچھ نیا سیکھا ہو۔", rubricHints: ["سیکھنے کا طریقہ", "وسائل کا استعمال", "نتیجہ"], roleKeywords: [] },
  { id: 115, category: "behavioral", text: "دباؤ میں کام کیسے کرتے ہیں؟ کوئی مثال دیں۔", rubricHints: ["برداشت کی حکمت عملی", "مثال", "تحمل"], roleKeywords: [] },
];

const ROMAN_URDU_QUESTION_BANK: BankEntry[] = [
  // --- introduction (5) ---
  { id: 201, category: "introduction", text: "Apne baare mein batayein aur apne background ka khulasa pesh karein.", rubricHints: ["mutalliqa tajurba", "career ki pesh raft", "mukhtasar khulasa"], roleKeywords: [] },
  { id: 202, category: "introduction", text: "Aap is role mein kyun dilchaspi rakhtay hain?", rubricHints: ["hausla afzai", "role ka ilm", "company se mutabiqat"], roleKeywords: [] },
  { id: 203, category: "introduction", text: "Aik professional ke tor par aap ki sab se bari khoobiyan kya hain?", rubricHints: ["khud aagahi", "mutalliqa khoobiyan", "thoos misaalein"], roleKeywords: [] },
  { id: 204, category: "introduction", text: "Aap khud ko aglay do se teen saal mein kahan dekhtay hain?", rubricHints: ["azaim", "haqeeqat pasandi", "role se hum ahangi"], roleKeywords: [] },
  { id: 205, category: "introduction", text: "Aap hamari company aur is position ke baare mein kya jaantay hain?", rubricHints: ["tehqeeq", "role ki samajh", "haqeeqi dilchaspi"], roleKeywords: [] },
  // --- behavioral (5) ---
  { id: 211, category: "behavioral", text: "Kisi teammate ke sath ikhtilaf ka koi waqia batayein aur aap ne usay kaisay hal kiya.", rubricHints: ["surat-e-haal", "baat cheet", "hal", "nateeja"], roleKeywords: [] },
  { id: 212, category: "behavioral", text: "Kisi mushkil deadline ka samna kaisay kiya? Tafseel batayein.", rubricHints: ["tarjeehat", "mansooba bandi", "nateeja"], roleKeywords: [] },
  { id: 213, category: "behavioral", text: "Kaam ya university mein ki gayi kisi ghalti aur us se seekhay gaye sabaq ke baare mein batayein.", rubricHints: ["zimma dari", "ghor-o-fikar", "islahi iqdam"], roleKeywords: [] },
  { id: 214, category: "behavioral", text: "Koi aisa waqt batayein jab aap ne bohat jaldi kuch naya seekha ho.", rubricHints: ["seekhnay ka tareeqa", "wasail ka istemal", "nateeja"], roleKeywords: [] },
  { id: 215, category: "behavioral", text: "Pressure mein kaam kaisay kartay hain? Koi misaal dein.", rubricHints: ["bardasht ki hikmat-e-amli", "misaal", "tahammul"], roleKeywords: [] },
];

/** Exported for honest count assertions in tests (see LANGUAGE_SUPPORT.md). */
export { URDU_QUESTION_BANK, ROMAN_URDU_QUESTION_BANK };

// ---------------------------------------------------------------------------
// Deterministic selection (seeded — same input → same questions, no Math.random)
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash — tiny, dependency-free, stable across runs. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — deterministic stream from a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeToken(w: string): string {
  return w.toLowerCase().trim();
}

function tokenSet(words: string[]): Set<string> {
  return new Set(words.map(normalizeToken).filter((w) => w.length > 1));
}

/** Localized bank for an interview language, or null for English. */
function localizedBank(lang: string): BankEntry[] | null {
  if (lang === "ur") return URDU_QUESTION_BANK;
  if (lang === "roman-ur") return ROMAN_URDU_QUESTION_BANK;
  return null;
}

export class TemplateQuestionProvider implements QuestionProvider {
  async generateQuestions(
    input: QuestionGenerationInput
  ): Promise<GeneratedQuestion[]> {
    const count = Math.min(10, Math.max(3, Math.floor(input.count) || 5));
    const interviewLang =
      input.interviewLanguage === "ur" ||
      input.interviewLanguage === "roman-ur"
        ? input.interviewLanguage
        : "en";
    const local = localizedBank(interviewLang);
    const skillTokens = tokenSet([
      ...input.requiredSkills,
      ...input.cvSkills,
      ...input.jobTitle.split(/[^a-zA-Z0-9+]+/),
    ]);

    const seed = hashSeed(
      `${input.jobTitle}|${[...skillTokens].sort().join(",")}|${count}|${interviewLang}`
    );
    const rng = mulberry32(seed);

    const byCategory = (c: QuestionCategory): BankEntry[] =>
      QUESTION_BANK.filter((q) => q.category === c);
    const localByCategory = (c: QuestionCategory): BankEntry[] =>
      local ? local.filter((q) => q.category === c) : [];

    // 1. Exactly one introduction question — localized when available.
    const intros = local ? localByCategory("introduction") : byCategory("introduction");
    const picked: BankEntry[] = [
      intros[Math.floor(rng() * intros.length)],
    ];

    // 2. Technical: English bank only (honest Phase D limitation — documented
    // in LANGUAGE_SUPPORT.md). Ranked by roleKeyword overlap as before.
    const technical = byCategory("technical")
      .map((q) => ({
        q,
        score: q.roleKeywords.filter((k) => skillTokens.has(k)).length,
      }))
      .sort((a, b) => b.score - a.score || a.q.id - b.q.id);
    const techWanted = Math.min(
      technical.length,
      Math.max(1, Math.round((count - 1) * 0.6))
    );
    for (let i = 0; i < techWanted; i++) picked.push(technical[i].q);

    // 3. Fill the remainder: localized behavioral first (seeded shuffle),
    // then English behavioral/situational when the localized bank runs out.
    const localRest = [...localByCategory("behavioral")];
    for (let i = localRest.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [localRest[i], localRest[j]] = [localRest[j], localRest[i]];
    }
    const englishRest = [...byCategory("behavioral"), ...byCategory("situational")];
    for (let i = englishRest.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [englishRest[i], englishRest[j]] = [englishRest[j], englishRest[i]];
    }
    const rest = local ? [...localRest, ...englishRest] : englishRest;
    const remaining = count - picked.length;
    for (let i = 0; i < remaining && i < rest.length; i++) {
      picked.push(rest[i]);
    }

    return picked.slice(0, count).map((q) => ({
      category: q.category,
      text: q.text,
      rubricHints: [...q.rubricHints],
    }));
  }

  // --- Extended capabilities: NOT faked by the template engine. ---------
  // Each throws AINotSupportedError so callers get an honest "configure an
  // AI provider" message instead of fabricated analysis.

  async healthCheck(): Promise<HealthCheckResult> {
    throw new AINotSupportedError(
      "Provider health checks need a configured AI provider (Gemini). " +
        "The template engine is local and has no remote health."
    );
  }

  async analyzeCV(_input: AnalyzeCVInput): Promise<AnalyzeCVResult> {
    throw new AINotSupportedError(
      "CV analysis is only available with a configured AI provider (Gemini)."
    );
  }

  async buildCVSection(
    _input: BuildCVSectionInput
  ): Promise<BuildCVSectionResult> {
    throw new AINotSupportedError(
      "CV section writing is only available with a configured AI provider (Gemini)."
    );
  }

  async generateSkillPlan(
    _input: GenerateSkillPlanInput
  ): Promise<GenerateSkillPlanResult> {
    throw new AINotSupportedError(
      "Skill plans are only available with a configured AI provider (Gemini)."
    );
  }
}

// ---------------------------------------------------------------------------
// Heuristic answer evaluation (transparent rubric — see module docstring)
// ---------------------------------------------------------------------------

const STOPWORDS_EN = new Set(
  "a,an,the,and,or,but,if,then,else,when,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should,now,i,me,my,we,our,you,your,he,him,his,she,her,it,its,they,them,their,what,which,who,whom,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,as,of".split(
    ","
  )
);

/**
 * Phase D: Urdu-script stopwords (hand-written function words — not a claim
 * of linguistic completeness). Without these, every Urdu answer would keep
 * only noise tokens and relevance scoring would silently penalize Urdu.
 */
const STOPWORDS_UR = new Set(
  "کا,کی,کے,ہے,ہیں,تھا,تھی,تھے,میں,نے,کو,سے,پر,اور,یا,جو,وہ,یہ,کیا,نہیں,بھی,تو,ایک,میرا,میری,میرے,آپ,ہم,اس,ان,جن,جس,کہ,لیے,ساتھ,طرف,بعد,پہلے,ہوں,ہو,گا,گی,گے,تک,نہ,ہی,ہوا,ہوئی,ہوئے,کر,کیا,کیے,ہوتا,ہوتی,ہوتے,رہا,رہی,رہے,دیا,دی,دیے,لیا,لی,لیے,والا,والی,والے,بہت,زیادہ,کم,سب,کوئی,کچھ,وہی,یہی,جیسے,جیسا,جیسی".split(
    ","
  )
);

/** Phase D: common Roman-Urdu function words (hand-written, same honesty note). */
const STOPWORDS_ROMAN_UR = new Set(
  "ka,ki,ke,hai,hain,tha,thi,the,mein,me,main,ne,ko,se,say,par,per,aur,ya,jo,woh,wo,ye,yeh,kya,nahi,nahin,bhi,to,tou,aik,ek,mera,meri,mere,aap,app,hum,ham,is,iss,us,uss,un,in,ke,liye,saath,sath,taraf,baad,pehlay,pehle,hun,ho,ga,gi,ge,tak,na,hi,hua,hui,hue,kar,kiya,kya,kye,hota,hoti,hotay,raha,rahi,rahe,diya,di,diye,liya,li,liye,wala,wali,walay,bohat,bahut,zyada,kam,sab,koi,kuch,wohii,yehi,jaise,jaisa,jaisi".split(
    ","
  )
);

function stopwordsFor(evalLang: string): Set<string> {
  if (evalLang === "ur") return STOPWORDS_UR;
  if (evalLang === "roman-ur")
    return new Set([...STOPWORDS_EN, ...STOPWORDS_ROMAN_UR]);
  return STOPWORDS_EN;
}

/**
 * Phase D: Unicode-aware tokenization. The old `[^a-z0-9]` character class
 * silently deleted every Urdu/Pashto/Sindhi word, which would have made
 * relevance scoring punish non-Latin answers. `\p{L}` keeps letters from
 * every script; the per-language stopword set then removes function words.
 */
function contentTokens(text: string, stopwords: Set<string>): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w));
}

function sentencesOf(text: string): string[] {
  return text
    .split(/[.!?۔]+/) // includes the Urdu full stop U+06D4
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Phase D: hand-written keyword translations for rubric-hint matching.
 * Coverage is deliberately small (~25 common interview keywords) and
 * documented as "partial" in LANGUAGE_SUPPORT.md — it lets an Urdu answer
 * to an Urdu question earn relevance honestly, without pretending we
 * translated the whole rubric.
 */
const KEYWORD_TRANSLATIONS_UR: Record<string, string[]> = {
  experience: ["تجربہ"],
  team: ["ٹیم"],
  project: ["پروجیکٹ", "منصوبہ"],
  challenge: ["چیلنج"],
  deadline: ["ڈیڈلائن"],
  learn: ["سیکھنا", "سیکھا"],
  mistake: ["غلطی"],
  feedback: ["فیڈبیک", "آراء"],
  pressure: ["دباؤ"],
  leadership: ["قیادت"],
  communication: ["بات", "چیت", "مواصلات"],
  example: ["مثال"],
  result: ["نتیجہ"],
  plan: ["منصوبہ"],
  problem: ["مسئلہ"],
  solution: ["حل"],
  work: ["کام"],
  time: ["وقت"],
  new: ["نیا", "نئی", "نئے"],
  help: ["مدد"],
  improve: ["بہتری", "بہتر"],
  company: ["کمپنی"],
  role: ["کردار", "عہدہ"],
  skill: ["مہارت"],
  strength: ["خوبی", "مضبوط"],
};

const KEYWORD_TRANSLATIONS_ROMAN_UR: Record<string, string[]> = {
  experience: ["tajurba"],
  team: ["team"],
  project: ["project", "mansooba"],
  challenge: ["challenge"],
  deadline: ["deadline"],
  learn: ["seekhna", "seekha"],
  mistake: ["ghalti"],
  feedback: ["feedback"],
  pressure: ["dabao", "pressure"],
  leadership: ["qayadat", "leadership"],
  communication: ["baat", "cheet"],
  example: ["misaal"],
  result: ["nateeja"],
  plan: ["mansooba", "plan"],
  problem: ["masla"],
  solution: ["hal", "solution"],
  work: ["kaam"],
  time: ["waqt", "time"],
  new: ["naya", "nai", "naye"],
  help: ["madad"],
  improve: ["behtari", "behtar"],
  company: ["company"],
  role: ["role", "kirdaar"],
  skill: ["skill", "maharat"],
  strength: ["khoobi", "mazboot"],
};

/**
 * Expands English rubric-hint tokens with their hand-written equivalents
 * in the evaluation language. Code-switched answers (Roman Urdu + English)
 * match on BOTH sides, so mixing languages is never penalized here.
 */
function expandHintTokens(tokens: string[], evalLang: string): string[] {
  const map =
    evalLang === "ur"
      ? KEYWORD_TRANSLATIONS_UR
      : evalLang === "roman-ur"
        ? KEYWORD_TRANSLATIONS_ROMAN_UR
        : null;
  if (!map) return tokens;
  const out = [...tokens];
  for (const t of tokens) {
    const extra = map[t];
    if (extra) out.push(...extra);
  }
  return out;
}

const STRUCTURE_MARKERS: string[][] = [
  ["first of all", "to begin", "to start", "let me start", "i am", "my name is"],
  ["because", "for example", "for instance", "however", "then", "next", "also", "in addition", "such as", "on the other hand"],
  ["in conclusion", "finally", "overall", "in summary", "to sum up", "to conclude"],
];

const EXAMPLE_SIGNALS = /\b(for example|for instance|e\.g\.|such as)\b/i;
const HAS_DIGIT = /\d/;

function scoreRelevance(
  answerTokens: string[],
  questionTokens: string[],
  hintTokens: string[]
): number {
  const answerSet = new Set(answerTokens);
  const hintHits = hintTokens.filter((t) => answerSet.has(t)).length;
  const questionSet = new Set(questionTokens);
  const questionHits = answerTokens.filter((t) => questionSet.has(t)).length;
  let score = 1;
  if (hintHits >= 4 || questionHits >= 4) score = 5;
  else if (hintHits >= 3 || questionHits >= 3) score = 4;
  else if (hintHits >= 2 || questionHits >= 2) score = 3;
  else if (hintHits >= 1 || questionHits >= 1) score = 2;
  return score;
}

function scoreDepth(wordCount: number, raw: string): number {
  let score: number;
  if (wordCount >= 150) score = 5;
  else if (wordCount >= 80) score = 4;
  else if (wordCount >= 40) score = 3;
  else if (wordCount >= 15) score = 2;
  else score = 1;
  // Concrete specifics (numbers, worked examples) signal real depth.
  if ((HAS_DIGIT.test(raw) || EXAMPLE_SIGNALS.test(raw)) && score < 5) {
    score += 1;
  }
  return score;
}

function scoreClarity(wordCount: number, sentences: string[]): number {
  if (wordCount < 10) return 1;
  if (sentences.length === 1) return wordCount >= 15 ? 3 : 2;
  const avg = wordCount / sentences.length;
  if (avg > 45) return 2; // run-on sentences
  if (avg >= 8) return 5;
  if (avg >= 5) return 4;
  return 3;
}

function scoreStructure(rawLower: string, wordCount: number): number {
  const groupsPresent = STRUCTURE_MARKERS.filter((markers) =>
    markers.some((m) => rawLower.includes(m))
  ).length;
  if (groupsPresent >= 3) return 5;
  if (groupsPresent === 2) return 4;
  if (groupsPresent === 1) return 3;
  return wordCount >= 40 ? 3 : 2;
}

export class TemplateAnswerEvaluator implements AnswerEvaluator {
  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    // Phase D: language-aware evaluation. feedbackLanguage picks the
    // feedback sentence templates (English fallback is logged, never
    // silent); evaluationLanguage picks stopwords + rubric keyword
    // translations. Length/structure heuristics stay language-agnostic.
    const evalLang = input.evaluationLanguage ?? "en";
    const { strings: fb } = feedbackStringsFor(input.feedbackLanguage);
    const stopwords = stopwordsFor(evalLang);

    const raw = input.answerText.trim();
    const rawLower = raw.toLowerCase();
    const answerTokens = contentTokens(raw, stopwords);
    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    const sentences = sentencesOf(raw);
    const questionTokens = contentTokens(input.question, stopwords);
    const hintTokens = expandHintTokens(
      input.rubricHints.flatMap((h) => contentTokens(h, stopwords)),
      evalLang
    );

    const scores: DimensionScores = {
      relevance: scoreRelevance(answerTokens, questionTokens, hintTokens),
      depth: scoreDepth(wordCount, raw),
      clarity: scoreClarity(wordCount, sentences),
      structure: scoreStructure(rawLower, wordCount),
    };
    const overallScore =
      Math.round(
        ((scores.relevance + scores.depth + scores.clarity + scores.structure) /
          4) *
          100
      ) / 100;

    const strengths: string[] = [];
    const improvements: string[] = [];
    (Object.keys(scores) as (keyof DimensionScores)[]).forEach((dim) => {
      if (scores[dim] >= 4) strengths.push(fb.strength[dim]);
      else if (scores[dim] <= 2) improvements.push(fb.improvement[dim]);
    });

    const weak = (Object.keys(scores) as (keyof DimensionScores)[]).filter(
      (d) => scores[d] <= 2
    );
    const strong = (Object.keys(scores) as (keyof DimensionScores)[]).filter(
      (d) => scores[d] >= 4
    );

    return {
      scores,
      overallScore,
      feedbackText: [
        fb.summary(
          overallScore.toFixed(2),
          strong.map((d) => fb.dimensionLabel[d]),
          weak.map((d) => fb.dimensionLabel[d])
        ),
        fb.honestyNote,
      ].join(" "),
      strengths,
      improvements,
    };
  }
}
