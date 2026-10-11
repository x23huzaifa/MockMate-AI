/**
 * AI CV Builder (protected): guided CV creation with live preview.
 *
 * - Documents are stored server-side (/api/v1/cv-builder): create, rename,
 *   edit, duplicate, delete. Every section is editable; freshers can leave
 *   experience empty — nothing forces invented history.
 * - "AI assist" buttons call the provider's buildCVSection (Gemini when
 *   configured). In template/demo mode the server returns 503 and the UI
 *   says so honestly — suggestions are never faked.
 * - Three CSS-only templates: modern, minimal, professional.
 * - Download HTML produces a standalone file; Print uses the browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  FONT,
  button,
  buttonDisabled,
  card,
  errorBox,
  input,
  label,
  link,
  pageWrap,
  subtitle,
  successBox,
  title,
} from "./styles";

interface DocSummary {
  id: number;
  title: string;
  template: string;
  updatedAt: string;
}

interface EducationEntry {
  school: string;
  degree: string;
  years: string;
}
interface ProjectEntry {
  name: string;
  description: string;
}
interface ExperienceEntry {
  title: string;
  company: string;
  years: string;
  details: string;
}
interface CvContent {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  summary: string;
  targetRole: string;
  education: EducationEntry[];
  skills: string[];
  projects: ProjectEntry[];
  experience: ExperienceEntry[];
  certifications: string[];
  languages: string[];
}
interface DocFull extends DocSummary {
  content: CvContent | null;
  createdAt: string;
}
interface AssistSuggestion {
  heading: string;
  lines: string[];
}

const TEMPLATES = [
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "professional", label: "Professional" },
];

const ASSISTABLE: { section: string; label: string }[] = [
  { section: "summary", label: "Summary" },
  { section: "skills", label: "Skills wording" },
  { section: "experience", label: "Experience bullets" },
  { section: "projects", label: "Project descriptions" },
];

function emptyContent(): CvContent {
  return {
    fullName: "",
    email: "",
    phone: "",
    headline: "",
    summary: "",
    targetRole: "",
    education: [],
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
    languages: [],
  };
}

function splitLines(v: string): string[] {
  return v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const sectionHead: CSSProperties = {
  margin: "1.4rem 0 0.6rem",
  fontSize: "1rem",
  fontWeight: 700,
  color: "#182033",
};

const row2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.6rem",
};

const smallBtn: CSSProperties = {
  ...button,
  padding: "0.35rem 0.7rem",
  fontSize: "0.82rem",
};

const dangerBtn: CSSProperties = {
  ...smallBtn,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

const entryBox: CSSProperties = {
  border: "1px solid #e6eaf2",
  borderRadius: 10,
  padding: "0.7rem",
  marginBottom: "0.6rem",
  background: "#fbfcfe",
};

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "300px 1fr",
  gap: "1rem",
  alignItems: "start",
};

const editorPreview: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
  alignItems: "start",
};

const assistBox: CSSProperties = {
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  borderRadius: 10,
  padding: "0.8rem",
  marginTop: "0.6rem",
  fontSize: "0.88rem",
};

export default function CvBuilder() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [content, setContent] = useState<CvContent>(emptyContent());
  const [docTitle, setDocTitle] = useState("");
  const [template, setTemplate] = useState("modern");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assistSection, setAssistSection] = useState<string | null>(null);
  const [assistBullets, setAssistBullets] = useState("");
  const [assistLoading, setAssistLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AssistSuggestion | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const initialized = useRef(false);
  const loadList = useCallback(async () => {
    try {
      const data = await api<{ documents: DocSummary[] }>("/api/v1/cv-builder");
      setDocs(data.documents);
      if (!initialized.current) {
        initialized.current = true;
        if (data.documents.length > 0) setActiveId(data.documents[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDoc = useCallback(async (id: number) => {
    setError(null);
    setNotice(null);
    setSuggestion(null);
    try {
      const data = await api<{ document: DocFull }>(
        `/api/v1/cv-builder/${id}`
      );
      setDocTitle(data.document.title);
      setTemplate(data.document.template);
      setContent({ ...emptyContent(), ...(data.document.content ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document.");
    }
  }, []);

  useEffect(() => {
    if (activeId !== null) loadDoc(activeId);
  }, [activeId, loadDoc]);

  function set<K extends keyof CvContent>(key: K, value: CvContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  async function handleCreate() {
    setError(null);
    try {
      const data = await api<{ document: DocFull }>("/api/v1/cv-builder", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim() || "Untitled CV",
          template: "modern",
        }),
      });
      setNewTitle("");
      setDocs((d) => [data.document, ...(d ?? [])]);
      setActiveId(data.document.id);
      setNotice("CV created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create CV.");
    }
  }

  async function handleSave() {
    if (activeId === null) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api<{ document: DocFull }>(
        `/api/v1/cv-builder/${activeId}`,
        {
          method: "PUT",
          body: JSON.stringify({ title: docTitle, template, content }),
        }
      );
      setDocs((d) =>
        (d ?? []).map((x) =>
          x.id === activeId
            ? {
                ...x,
                title: data.document.title,
                template: data.document.template,
                updatedAt: data.document.updatedAt,
              }
            : x
        )
      );
      setNotice("Draft saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (activeId === null) return;
    try {
      const data = await api<{ document: DocFull }>(
        `/api/v1/cv-builder/${activeId}/duplicate`,
        { method: "POST" }
      );
      setDocs((d) => [data.document, ...(d ?? [])]);
      setActiveId(data.document.id);
      setNotice("Duplicated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate.");
    }
  }

  async function handleDelete() {
    if (activeId === null) return;
    if (!window.confirm(`Delete "${docTitle}"? This cannot be undone.`)) return;
    try {
      await api(`/api/v1/cv-builder/${activeId}`, { method: "DELETE" });
      setDocs((d) => (d ?? []).filter((x) => x.id !== activeId));
      setActiveId(null);
      setContent(emptyContent());
      setNotice("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    }
  }

  async function handleAssist(section: string) {
    const bullets = splitLines(assistBullets);
    if (bullets.length === 0) {
      setError("Write at least one key point (one per line) for the AI to work with.");
      return;
    }
    setAssistLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const data = await api<{ suggestion: AssistSuggestion }>(
        "/api/v1/cv-builder/assist",
        {
          method: "POST",
          body: JSON.stringify({
            section,
            userBullets: bullets,
            targetRole: content.targetRole || undefined,
          }),
        }
      );
      setSuggestion(data.suggestion);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "AI assist failed. Try again."
      );
    } finally {
      setAssistLoading(false);
    }
  }

  function applySuggestion(section: string) {
    if (!suggestion) return;
    const text = suggestion.lines.join("\n");
    if (section === "summary") set("summary", text);
    else if (section === "skills")
      set("skills", [...content.skills, ...suggestion.lines]);
    else if (section === "experience")
      set("experience", [
        ...content.experience,
        {
          title: "",
          company: "",
          years: "",
          details: text,
        },
      ]);
    else if (section === "projects")
      set("projects", [
        ...content.projects,
        { name: suggestion.heading || "Project", description: text },
      ]);
    setSuggestion(null);
    setAssistBullets("");
    setNotice("Suggestion applied — review and edit it before saving.");
  }

  function downloadHtml() {
    const html = buildStandaloneHtml(docTitle || "CV", content, template);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(content.fullName || docTitle || "cv").replace(/[^\w\-]+/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <p style={{ color: "#64748B", fontFamily: FONT }}>Loading CV builder…</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 1180 }}>
        <h1 style={title}>AI CV Builder</h1>
        <p style={subtitle}>
          Build your CV section by section, preview it live, and download it.
          AI suggestions only rephrase <em>your</em> facts — never invent
          degrees, employers, or skills.
        </p>
        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}
        {notice && <div style={successBox} role="status">{notice}</div>}

        <div style={layout}>
          {/* Document list */}
          <aside>
            <h2 style={{ ...sectionHead, marginTop: 0 }}>My CVs</h2>
            {(docs ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveId(d.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.7rem",
                  marginBottom: "0.4rem",
                  borderRadius: 10,
                  border:
                    d.id === activeId
                      ? "1px solid #c7d2fe"
                      : "1px solid #e6eaf2",
                  background: d.id === activeId ? "#eef2ff" : "#fff",
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                <strong style={{ display: "block", fontSize: "0.92rem" }}>
                  {d.title}
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                  {d.template}
                </span>
              </button>
            ))}
            {(docs ?? []).length === 0 && (
              <p style={{ color: "#64748B", fontSize: "0.9rem" }}>
                No CVs yet — create your first one below.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem" }}>
              <input
                style={{ ...input, flex: 1 }}
                placeholder="New CV title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                aria-label="New CV title"
              />
              <button type="button" style={smallBtn} onClick={handleCreate}>
                Create
              </button>
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
              <Link to="/dashboard" style={link}>
                ← Dashboard
              </Link>
            </p>
          </aside>

          {/* Editor + preview */}
          <div>
            {activeId === null ? (
              <p style={{ color: "#64748B" }}>
                Select a CV on the left, or create a new one to start.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    style={{ ...input, maxWidth: 260 }}
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    aria-label="CV title"
                  />
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTemplate(t.value)}
                      style={{
                        ...smallBtn,
                        background:
                          template === t.value ? "#4F7CFF" : "#ffffff",
                        color: template === t.value ? "#ffffff" : "#182033",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "1rem",
                  }}
                >
                  <button
                    type="button"
                    style={saving ? buttonDisabled : button}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                  <button type="button" style={smallBtn} onClick={handleDuplicate}>
                    Duplicate
                  </button>
                  <button type="button" style={smallBtn} onClick={downloadHtml}>
                    Download HTML
                  </button>
                  <button
                    type="button"
                    style={smallBtn}
                    onClick={() => window.print()}
                  >
                    Print
                  </button>
                  <button type="button" style={dangerBtn} onClick={handleDelete}>
                    Delete
                  </button>
                </div>

                <div style={editorPreview}>
                  <div>
                    <h2 style={sectionHead}>Personal info</h2>
                    <label style={label}>Full name</label>
                    <input
                      style={input}
                      value={content.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                    />
                    <div style={row2}>
                      <div>
                        <label style={label}>Email</label>
                        <input
                          style={input}
                          value={content.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={label}>Phone</label>
                        <input
                          style={input}
                          value={content.phone}
                          onChange={(e) => set("phone", e.target.value)}
                        />
                      </div>
                    </div>
                    <label style={label}>Professional headline</label>
                    <input
                      style={input}
                      value={content.headline}
                      onChange={(e) => set("headline", e.target.value)}
                      placeholder="e.g. CS student · React & Python"
                    />
                    <label style={label}>Target role</label>
                    <input
                      style={input}
                      value={content.targetRole}
                      onChange={(e) => set("targetRole", e.target.value)}
                      placeholder="e.g. Frontend Developer"
                    />

                    <h2 style={sectionHead}>Summary</h2>
                    <textarea
                      style={{ ...input, minHeight: 90 }}
                      value={content.summary}
                      onChange={(e) => set("summary", e.target.value)}
                      placeholder="2–4 sentences about you…"
                    />

                    <h2 style={sectionHead}>AI writing assist</h2>
                    <p style={{ fontSize: "0.85rem", color: "#64748B" }}>
                      Pick a section, list your key points (one per line), and
                      get phrasing help. Requires a configured AI provider;
                      everything stays editable.
                    </p>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {ASSISTABLE.map((a) => (
                        <button
                          key={a.section}
                          type="button"
                          onClick={() => {
                            setAssistSection(a.section);
                            setSuggestion(null);
                          }}
                          style={{
                            ...smallBtn,
                            background:
                              assistSection === a.section
                                ? "#4F7CFF"
                                : "#ffffff",
                            color:
                              assistSection === a.section
                                ? "#ffffff"
                                : "#182033",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                    {assistSection && (
                      <div style={{ marginTop: "0.6rem" }}>
                        <textarea
                          style={{ ...input, minHeight: 70 }}
                          value={assistBullets}
                          onChange={(e) => setAssistBullets(e.target.value)}
                          placeholder={"Your key points, one per line:\n• Built a todo app in React\n• 6-month web dev course"}
                          aria-label="Key points for AI assist"
                        />
                        <button
                          type="button"
                          style={assistLoading ? buttonDisabled : smallBtn}
                          onClick={() => handleAssist(assistSection)}
                          disabled={assistLoading}
                        >
                          {assistLoading ? "Thinking…" : "Get AI suggestion"}
                        </button>
                      </div>
                    )}
                    {suggestion && assistSection && (
                      <div style={assistBox}>
                        <strong>{suggestion.heading}</strong>
                        <ul style={{ margin: "0.4rem 0", paddingLeft: "1.1rem" }}>
                          {suggestion.lines.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            style={smallBtn}
                            onClick={() => applySuggestion(assistSection)}
                          >
                            Use this
                          </button>
                          <button
                            type="button"
                            style={smallBtn}
                            onClick={() => setSuggestion(null)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <ListEditor
                      title="Education"
                      items={content.education}
                      onChange={(v) => set("education", v)}
                      fields={[
                        { key: "school", label: "School / university" },
                        { key: "degree", label: "Degree" },
                        { key: "years", label: "Years" },
                      ]}
                      empty={{ school: "", degree: "", years: "" }}
                    />
                    <ListEditor
                      title="Projects"
                      items={content.projects}
                      onChange={(v) => set("projects", v)}
                      fields={[
                        { key: "name", label: "Project name" },
                        { key: "description", label: "Description" },
                      ]}
                      empty={{ name: "", description: "" }}
                    />
                    <ListEditor
                      title="Experience (optional — leave empty if fresher)"
                      items={content.experience}
                      onChange={(v) => set("experience", v)}
                      fields={[
                        { key: "title", label: "Job title" },
                        { key: "company", label: "Company" },
                        { key: "years", label: "Years" },
                        { key: "details", label: "What you did" },
                      ]}
                      empty={{ title: "", company: "", years: "", details: "" }}
                    />

                    <h2 style={sectionHead}>Skills (comma separated)</h2>
                    <input
                      style={input}
                      value={content.skills.join(", ")}
                      onChange={(e) =>
                        set(
                          "skills",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="React, Python, SQL"
                    />
                    <h2 style={sectionHead}>Certifications (comma separated)</h2>
                    <input
                      style={input}
                      value={content.certifications.join(", ")}
                      onChange={(e) =>
                        set(
                          "certifications",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                    />
                    <h2 style={sectionHead}>Languages (comma separated)</h2>
                    <input
                      style={input}
                      value={content.languages.join(", ")}
                      onChange={(e) =>
                        set(
                          "languages",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="English, Urdu"
                    />
                  </div>

                  <div>
                    <h2 style={sectionHead}>Live preview</h2>
                    <CvPreview
                      content={content}
                      template={template}
                      title={docTitle}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Generic dynamic list editor for education/projects/experience. */
function ListEditor<T extends Record<string, string>>({
  title,
  items,
  onChange,
  fields,
  empty,
}: {
  title: string;
  items: T[];
  onChange: (v: T[]) => void;
  fields: { key: keyof T & string; label: string }[];
  empty: T;
}) {
  function update(i: number, key: keyof T & string, value: string) {
    onChange(items.map((it, j) => (j === i ? { ...it, [key]: value } : it)));
  }
  return (
    <div>
      <h2 style={sectionHead}>{title}</h2>
      {items.map((item, i) => (
        <div key={i} style={entryBox}>
          {fields.map((f) => (
            <div key={f.key} style={{ marginBottom: "0.4rem" }}>
              <label style={{ ...label, margin: "0 0 0.2rem" }}>
                {f.label}
              </label>
              <input
                style={input}
                value={item[f.key]}
                onChange={(e) => update(i, f.key, e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            style={dangerBtn}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        style={smallBtn}
        onClick={() => onChange([...items, { ...empty }])}
      >
        + Add
      </button>
    </div>
  );
}

/** Live CV preview — three CSS-only template variants. */
function CvPreview({
  content,
  template,
  title,
}: {
  content: CvContent;
  template: string;
  title: string;
}) {
  const head: CSSProperties =
    template === "professional"
      ? { background: "#182033", color: "#fff", padding: "1.2rem" }
      : template === "minimal"
        ? { padding: "0.4rem 0", borderBottom: "2px solid #182033" }
        : { background: "#4F7CFF", color: "#fff", padding: "1.2rem" };
  const headName: CSSProperties = {
    margin: 0,
    fontSize: "1.4rem",
    color: template === "minimal" ? "#182033" : "#fff",
  };
  const h3: CSSProperties = {
    fontSize: "0.95rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: template === "modern" ? "#4F7CFF" : "#182033",
    borderBottom:
      template === "minimal" ? "1px solid #e6eaf2" : "none",
    paddingBottom: template === "minimal" ? "0.3rem" : 0,
    margin: "1rem 0 0.4rem",
  };
  const body: CSSProperties = {
    border: "1px solid #e6eaf2",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    fontFamily: FONT,
    fontSize: "0.88rem",
    color: "#182033",
  };
  const muted: CSSProperties = {
    color: template === "minimal" ? "#64748B" : "inherit",
    opacity: template === "minimal" ? 1 : 0.85,
    fontSize: "0.82rem",
  };
  const contact = [content.email, content.phone].filter(Boolean).join(" · ");
  return (
    <div style={body} aria-label={`CV preview (${title || "untitled"})`}>
      <div style={head}>
        <h2 style={headName}>{content.fullName || "Your Name"}</h2>
        {content.headline && <div style={muted}>{content.headline}</div>}
        {contact && <div style={muted}>{contact}</div>}
      </div>
      <div style={{ padding: "1rem 1.2rem" }}>
        {content.summary && (
          <>
            <h3 style={h3}>Summary</h3>
            <p style={{ margin: "0.3rem 0" }}>{content.summary}</p>
          </>
        )}
        {content.skills.length > 0 && (
          <>
            <h3 style={h3}>Skills</h3>
            <p style={{ margin: "0.3rem 0" }}>
              {content.skills.join(" · ")}
            </p>
          </>
        )}
        {content.experience.length > 0 && (
          <>
            <h3 style={h3}>Experience</h3>
            {content.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: "0.5rem" }}>
                <strong>
                  {e.title}
                  {e.company ? ` — ${e.company}` : ""}
                </strong>
                {e.years && <span style={muted}> ({e.years})</span>}
                {e.details && (
                  <p style={{ margin: "0.2rem 0" }}>{e.details}</p>
                )}
              </div>
            ))}
          </>
        )}
        {content.projects.length > 0 && (
          <>
            <h3 style={h3}>Projects</h3>
            {content.projects.map((p, i) => (
              <div key={i} style={{ marginBottom: "0.5rem" }}>
                <strong>{p.name}</strong>
                {p.description && (
                  <p style={{ margin: "0.2rem 0" }}>{p.description}</p>
                )}
              </div>
            ))}
          </>
        )}
        {content.education.length > 0 && (
          <>
            <h3 style={h3}>Education</h3>
            {content.education.map((e, i) => (
              <div key={i} style={{ marginBottom: "0.4rem" }}>
                <strong>{e.school}</strong>
                {(e.degree || e.years) && (
                  <span style={muted}>
                    {" "}
                    — {[e.degree, e.years].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            ))}
          </>
        )}
        {content.certifications.length > 0 && (
          <>
            <h3 style={h3}>Certifications</h3>
            <p style={{ margin: "0.3rem 0" }}>
              {content.certifications.join(" · ")}
            </p>
          </>
        )}
        {content.languages.length > 0 && (
          <>
            <h3 style={h3}>Languages</h3>
            <p style={{ margin: "0.3rem 0" }}>
              {content.languages.join(" · ")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Standalone printable HTML export of the CV. */
function buildStandaloneHtml(
  title: string,
  c: CvContent,
  template: string
): string {
  const accent = template === "professional" ? "#182033" : "#4F7CFF";
  const sec = (h: string, body: string) =>
    body ? `<h2>${h}</h2>${body}` : "";
  const p = (t: string) => (t ? `<p>${escapeHtml(t)}</p>` : "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(title || "CV")}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#182033}
header{border-bottom:3px solid ${accent};padding-bottom:1rem;margin-bottom:1rem}
h1{margin:0;font-size:1.8rem}h2{font-size:1rem;text-transform:uppercase;letter-spacing:.06em;color:${accent};margin:1.2rem 0 .4rem}
.muted{color:#64748B;font-size:.9rem}</style></head><body>
<header><h1>${escapeHtml(c.fullName || "Your Name")}</h1>
${c.headline ? `<div>${escapeHtml(c.headline)}</div>` : ""}
${[c.email, c.phone].filter(Boolean).map(escapeHtml).join(" · ") ? `<div class="muted">${[c.email, c.phone].filter(Boolean).map(escapeHtml).join(" · ")}</div>` : ""}</header>
${sec("Summary", p(c.summary))}
${sec("Skills", c.skills.length ? p(c.skills.map(escapeHtml).join(" · ")) : "")}
${sec("Experience", c.experience.map((e) => `<p><strong>${escapeHtml(e.title)}${e.company ? " — " + escapeHtml(e.company) : ""}</strong> <span class="muted">${escapeHtml(e.years)}</span><br>${escapeHtml(e.details)}</p>`).join(""))}
${sec("Projects", c.projects.map((x) => `<p><strong>${escapeHtml(x.name)}</strong><br>${escapeHtml(x.description)}</p>`).join(""))}
${sec("Education", c.education.map((e) => `<p><strong>${escapeHtml(e.school)}</strong> <span class="muted">${escapeHtml([e.degree, e.years].filter(Boolean).join(", "))}</span></p>`).join(""))}
${sec("Certifications", c.certifications.length ? p(c.certifications.map(escapeHtml).join(" · ")) : "")}
${sec("Languages", c.languages.length ? p(c.languages.map(escapeHtml).join(" · ")) : "")}
</body></html>`;
}
