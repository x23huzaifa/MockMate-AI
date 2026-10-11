/**
 * Interview session state machine.
 *
 * Single source of truth for legal status transitions. Routes MUST go
 * through `assertTransition` before persisting a status change — an
 * illegal move throws StateError and the route returns 409.
 *
 * States:
 *   created         — session row + questions exist, interview not started
 *   asking          — (transient) moving to the next question
 *   awaiting_answer — a question is presented; the client may submit an answer
 *   evaluating      — (transient) an answer was submitted, evaluation running
 *   completed       — all questions answered and evaluated
 *   paused          — user paused; resume returns to awaiting_answer
 *   interrupted     — client explicitly ended early / gave up
 *   failed          — unrecoverable server-side error
 *
 * Diagram:
 *   created → asking → awaiting_answer → evaluating → awaiting_answer …
 *                          ↕ pause/resume              ↘ (last Q) completed
 *   any → paused | interrupted | failed
 */
export const INTERVIEW_STATUSES = [
  "created",
  "asking",
  "awaiting_answer",
  "evaluating",
  "completed",
  "paused",
  "interrupted",
  "failed",
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export function isInterviewStatus(value: unknown): value is InterviewStatus {
  return (
    typeof value === "string" &&
    (INTERVIEW_STATUSES as readonly string[]).includes(value)
  );
}

export class StateError extends Error {
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(`Illegal interview transition: ${from} → ${to}.`);
    this.name = "StateError";
    this.from = from;
    this.to = to;
  }
}

const TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  created: ["asking", "paused", "interrupted", "failed"],
  asking: ["awaiting_answer", "paused", "interrupted", "failed"],
  awaiting_answer: ["evaluating", "paused", "interrupted", "failed"],
  evaluating: ["awaiting_answer", "completed", "paused", "interrupted", "failed"],
  paused: ["awaiting_answer", "interrupted", "failed"],
  completed: [],
  interrupted: [],
  failed: [],
};

export function canTransition(
  from: InterviewStatus,
  to: InterviewStatus
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throws StateError when the transition is not allowed. */
export function assertTransition(
  from: InterviewStatus,
  to: InterviewStatus
): void {
  if (!canTransition(from, to)) {
    throw new StateError(from, to);
  }
}
