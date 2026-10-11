/**
 * MockMate AI logo concepts.
 *
 * Eight distinct SVG marks drawn in the EXISTING theme palette only:
 * primary #4F7CFF, accent #8B5CF6, ink #182033, dark #0B1020.
 * No new colors, no generic robot faces, no photographic detail.
 *
 * `SiteLogo` is the navbar logo: it reads the user's pick from
 * localStorage ("mockmate_logo") and falls back to the original inline
 * text logo when nothing is picked, so the site looks unchanged by default.
 */
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { FONT } from "../pages/styles";

export const LOGO_STORAGE_KEY = "mockmate_logo";

export type LogoVariant = "icon" | "navbar" | "light" | "dark";

export type LogoId =
  | "bubble-spark"
  | "mm-lettermark"
  | "connect-arc"
  | "mic-chat"
  | "arrow-up"
  | "geo-m"
  | "duo-faces"
  | "cap-chat";

export interface MarkProps {
  size?: number;
}

const PRIMARY = "#4F7CFF";
const ACCENT = "#8B5CF6";
const INK = "#182033";
const DARK = "#0B1020";
const WHITE = "#ffffff";

/** 1. Speech bubble + spark — conversation with a smart twist. */
function BubbleSpark({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="6"
        y="7"
        width="36"
        height="26"
        rx="9"
        fill="none"
        stroke={PRIMARY}
        strokeWidth="3.5"
      />
      <path d="M15 33 L12 42 L23 33 Z" fill={PRIMARY} />
      <path
        d="M25 12 l2.4 5.2 5.2 2.4 -5.2 2.4 -2.4 5.2 -2.4 -5.2 -5.2 -2.4 5.2 -2.4 Z"
        fill={ACCENT}
      />
    </svg>
  );
}

/** 2. Minimalist MM lettermark in a rounded square. */
function MMLettermark({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="11" fill={PRIMARY} />
      <text
        x="22"
        y="33"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill={WHITE}
        fontFamily={FONT}
      >
        M
      </text>
      <circle cx="34" cy="30" r="4" fill={ACCENT} />
    </svg>
  );
}

/** 3. Human–AI connection — two arcs meeting at one node. */
function ConnectArc({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M7 36 Q16 36 21 22"
        fill="none"
        stroke={PRIMARY}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M41 36 Q32 36 27 22"
        fill="none"
        stroke={ACCENT}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="15" r="6" fill={INK} />
      <circle cx="7" cy="36" r="3.5" fill={PRIMARY} />
      <circle cx="41" cy="36" r="3.5" fill={ACCENT} />
    </svg>
  );
}

/** 4. Microphone inside a chat bubble — voice interview. */
function MicChat({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="6"
        y="7"
        width="36"
        height="26"
        rx="9"
        fill="none"
        stroke={PRIMARY}
        strokeWidth="3.5"
      />
      <path d="M15 33 L12 42 L23 33 Z" fill={PRIMARY} />
      <rect x="21" y="12" width="6" height="11" rx="3" fill={ACCENT} />
      <path
        d="M17.5 21 a6.5 6.5 0 0 0 13 0"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="27.5"
        x2="24"
        y2="30.5"
        stroke={ACCENT}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 5. Career growth — upward arrow rising from a chat bubble. */
function ArrowUp({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="6"
        y="18"
        width="36"
        height="20"
        rx="9"
        fill="none"
        stroke={PRIMARY}
        strokeWidth="3.5"
      />
      <path d="M15 38 L12 44 L23 38 Z" fill={PRIMARY} />
      <path
        d="M24 30 L24 10 M17 17 L24 10 L31 17"
        fill="none"
        stroke={ACCENT}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 6. Premium geometric M — pure angles, no curves. */
function GeoM({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <polyline
        points="8,38 8,10 24,26 40,10 40,38"
        fill="none"
        stroke={PRIMARY}
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect x="21" y="30" width="6" height="6" fill={ACCENT} />
    </svg>
  );
}

/** 7. Interview duo — two abstract facing profiles, one human, one AI. */
function DuoFaces({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="15" cy="16" r="6.5" fill={PRIMARY} />
      <path
        d="M5 38 Q5 29 15 29 Q25 29 25 38 Z"
        fill={PRIMARY}
        opacity="0.85"
      />
      <circle cx="33" cy="16" r="6.5" fill={ACCENT} />
      <path
        d="M23 38 Q23 29 33 29 Q43 29 43 38 Z"
        fill={ACCENT}
        opacity="0.85"
      />
      <path
        d="M24 8 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 Z"
        fill={INK}
      />
    </svg>
  );
}

/** 8. Graduation cap + chat — learning through conversation. */
function CapChat({ size = 48 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <polygon points="24,5 45,14 24,23 3,14" fill={PRIMARY} />
      <path
        d="M11 18.5 V27 Q24 34 37 27 V18.5"
        fill="none"
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line
        x1="37"
        y1="18.5"
        x2="37"
        y2="30"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="37" cy="33" r="2.5" fill={INK} />
      <path d="M17 38 L15 44 L21 38 Z" fill={PRIMARY} />
    </svg>
  );
}

export interface LogoConcept {
  id: LogoId;
  name: string;
  description: string;
  Mark: ComponentType<MarkProps>;
}

export const LOGO_CONCEPTS: LogoConcept[] = [
  {
    id: "bubble-spark",
    name: "Bubble Spark",
    description: "Chat bubble with a spark — smart conversation.",
    Mark: BubbleSpark,
  },
  {
    id: "mm-lettermark",
    name: "MM Lettermark",
    description: "Bold M monogram in a rounded square.",
    Mark: MMLettermark,
  },
  {
    id: "connect-arc",
    name: "Human–AI Link",
    description: "Two arcs meeting at one node — human and AI connecting.",
    Mark: ConnectArc,
  },
  {
    id: "mic-chat",
    name: "Voice Bubble",
    description: "Microphone in a chat bubble — voice interviews.",
    Mark: MicChat,
  },
  {
    id: "arrow-up",
    name: "Career Rise",
    description: "Upward arrow from a chat bubble — growth through practice.",
    Mark: ArrowUp,
  },
  {
    id: "geo-m",
    name: "Geo M",
    description: "Minimal geometric M built from straight angles.",
    Mark: GeoM,
  },
  {
    id: "duo-faces",
    name: "Interview Duo",
    description: "Two facing profiles — candidate and AI coach.",
    Mark: DuoFaces,
  },
  {
    id: "cap-chat",
    name: "Learn & Speak",
    description: "Graduation cap merged with chat — learning by speaking.",
    Mark: CapChat,
  },
];

/** Render one concept in a given variant. */
export function LogoMark({
  id,
  variant,
  size,
}: {
  id: LogoId;
  variant: LogoVariant;
  size?: number;
}) {
  const concept = LOGO_CONCEPTS.find((c) => c.id === id);
  if (!concept) return null;
  const Mark = concept.Mark;
  const s = size ?? (variant === "icon" ? 44 : 34);
  if (variant === "navbar") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.55rem",
        }}
      >
        <Mark size={30} />
        <span
          style={{
            fontWeight: 800,
            color: INK,
            fontSize: "1rem",
            fontFamily: FONT,
          }}
        >
          MockMate AI
        </span>
      </span>
    );
  }
  if (variant === "light" || variant === "dark") {
    const box = s + 28;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: box,
          height: box,
          borderRadius: 14,
          background: variant === "dark" ? DARK : WHITE,
          border: variant === "dark" ? "none" : "1px solid #e6eaf2",
        }}
      >
        <Mark size={s} />
      </span>
    );
  }
  return <Mark size={s} />;
}

function readStoredLogo(): LogoId | null {
  try {
    const raw = localStorage.getItem(LOGO_STORAGE_KEY);
    return LOGO_CONCEPTS.some((c) => c.id === raw) ? (raw as LogoId) : null;
  } catch {
    return null;
  }
}

/**
 * Navbar logo. Default (nothing picked) renders the ORIGINAL inline text
 * logo, so the site is visually unchanged until the user picks a concept
 * on /logo-concepts.
 */
export function SiteLogo() {
  const [id, setId] = useState<LogoId | null>(null);
  useEffect(() => {
    setId(readStoredLogo());
    const onStorage = () => setId(readStoredLogo());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!id) {
    return (
      <span
        style={{
          fontWeight: 800,
          color: INK,
          fontSize: "1rem",
          fontFamily: FONT,
        }}
      >
        MockMate AI
      </span>
    );
  }
  return <LogoMark id={id} variant="navbar" />;
}
