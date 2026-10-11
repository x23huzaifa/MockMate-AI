/**
 * pdf-parse ships no TypeScript declarations and DefinitelyTyped has none.
 * Shorthand ambient declaration types the module as `any`; the call site in
 * cvParser.ts casts the extraction result explicitly.
 * Pure-JS package — no native build step.
 */
declare module "pdf-parse";
