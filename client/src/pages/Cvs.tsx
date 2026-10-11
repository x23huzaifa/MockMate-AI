/**
 * My CVs page (protected): upload PDF/DOCX, list uploads with status,
 * inspect extracted fields + raw text, correct fields, delete.
 *
 * Every button does real work against /api/v1/cvs. Server errors arrive as
 * { error } and are shown verbatim.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  button,
  buttonDisabled,
  card,
  errorBox,
  footerText,
  input,
  label,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

const CV_MAX_BYTES = 5 * 1024 * 1024;

interface CvFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: string[];
  experienceYears: number | null;
}

interface CvItem {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: "uploaded" | "processing" | "ready" | "failed";
  parsedJson: (CvFields & { confidence: "low" | "medium" }) | null;
  userCorrectedJson: CvFields | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FIELDS: CvFields = {
  name: null,
  email: null,
  phone: null,
  skills: [],
  education: [],
  experienceYears: null,
};

const STATUS_STYLE: Record<CvItem["status"], CSSProperties> = {
  uploaded: { background: "#f1f5f9", color: "#475569" },
  processing: { background: "#fef3c7", color: "#92400e" },
  ready: { background: "#dcfce7", color: "#166534" },
  failed: { background: "#fee2e2", color: "#991b1b" },
};

const badge: CSSProperties = {
  display: "inline-block",
  padding: "0.15rem 0.6rem",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const fieldRow: CSSProperties = {
  display: "flex",
  gap: "1rem",
  padding: "0.55rem 0",
  borderBottom: "1px solid #eef1f6",
  fontSize: "0.92rem",
};
const fieldLabel: CSSProperties = {
  flex: "0 0 130px",
  color: "#64748B",
  fontWeight: 600,
};
const fieldValue: CSSProperties = { flex: 1, wordBreak: "break-word" };

const textarea: CSSProperties = {
  ...input,
  minHeight: 84,
  resize: "vertical",
  fontFamily: "inherit",
};

const listItem: CSSProperties = {
  width: "100%",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.8rem 1rem",
  marginTop: "0.6rem",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButton: CSSProperties = {
  ...button,
  background: "#ffffff",
  color: "#182033",
  border: "1px solid #cbd5e1",
};

const dangerButton: CSSProperties = {
  ...button,
  background: "#ffffff",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

function readError(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `Request failed (HTTP ${status}).`;
}

async function cvApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(readError(body, res.status));
  }
  return body as T;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function linesToText(items: string[]): string {
  return items.join("\n");
}

function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export default function Cvs() {
  const [cvs, setCvs] = useState<CvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CvItem | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editExp, setEditExp] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editEducation, setEditEducation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      const data = await cvApi<{ cvs: CvItem[] }>("/api/v1/cvs");
      setCvs(data.cvs);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load CVs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a PDF or DOCX file first.");
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      setUploadError("File too large. Maximum size is 5 MB.");
      return;
    }
    if (file.size === 0) {
      setUploadError("The selected file is empty.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("cv", file);
      const data = await cvApi<{ cv: CvItem }>("/api/v1/cvs", {
        method: "POST",
        body: form,
      });
      if (fileRef.current) fileRef.current.value = "";
      await loadList();
      setSelected(data.cv);
      setEditing(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function startEditing(cv: CvItem) {
    const f: CvFields = cv.userCorrectedJson ?? cv.parsedJson ?? EMPTY_FIELDS;
    setEditName(f.name ?? "");
    setEditEmail(f.email ?? "");
    setEditPhone(f.phone ?? "");
    setEditExp(f.experienceYears === null ? "" : String(f.experienceYears));
    setEditSkills(linesToText(f.skills));
    setEditEducation(linesToText(f.education));
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        name: editName.trim() === "" ? null : editName.trim(),
        email: editEmail.trim() === "" ? null : editEmail.trim(),
        phone: editPhone.trim() === "" ? null : editPhone.trim(),
        skills: textToLines(editSkills),
        education: textToLines(editEducation),
        experienceYears:
          editExp.trim() === "" ? null : Number(editExp.trim()),
      };
      const data = await cvApi<{ cv: CvItem }>(`/api/v1/cvs/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSelected(data.cv);
      setCvs((prev) => prev.map((c) => (c.id === data.cv.id ? data.cv : c)));
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (
      !window.confirm(
        `Delete "${selected.originalFilename}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await cvApi<{ ok: true }>(`/api/v1/cvs/${selected.id}`, {
        method: "DELETE",
      });
      setSelected(null);
      setEditing(false);
      await loadList();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const effective: CvFields | null = selected
    ? selected.userCorrectedJson ?? selected.parsedJson ?? null
    : null;
  const wasCorrected = !!selected?.userCorrectedJson;
  const confidence = selected?.parsedJson?.confidence ?? null;

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 720 }}>
        <h1 style={title}>My CVs</h1>
        <p style={subtitle}>
          Upload your CV (PDF or DOCX, up to 5 MB). We extract the details
          automatically — review and correct anything the parser missed.
        </p>

        <form onSubmit={handleUpload} noValidate>
          <label style={label} htmlFor="cv-file">
            CV file
          </label>
          <input
            id="cv-file"
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={uploading}
            style={{ ...input, padding: "0.55rem 0.8rem" }}
          />
          {uploadError && (
            <div role="alert" style={errorBox}>
              {uploadError}
            </div>
          )}
          <button
            type="submit"
            style={uploading ? buttonDisabled : button}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload CV"}
          </button>
        </form>

        <h2 style={{ ...title, fontSize: "1.15rem", marginTop: "2rem" }}>
          Uploaded CVs
        </h2>
        {loading && <p style={subtitle}>Loading…</p>}
        {listError && (
          <div role="alert" style={errorBox}>
            {listError}
          </div>
        )}
        {!loading && !listError && cvs.length === 0 && (
          <p style={subtitle}>No CVs yet — upload your first one above.</p>
        )}
        {cvs.map((cv) => (
          <button
            key={cv.id}
            type="button"
            style={{
              ...listItem,
              borderColor: selected?.id === cv.id ? "#4F7CFF" : "#e2e8f0",
              borderWidth: selected?.id === cv.id ? 2 : 1,
            }}
            onClick={() => {
              setSelected(cv);
              setEditing(false);
              setSaveError(null);
            }}
          >
            <span>
              <span style={{ fontWeight: 700 }}>{cv.originalFilename}</span>
              <br />
              <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                {formatSize(cv.fileSize)} · {formatDate(cv.createdAt)}
              </span>
            </span>
            <span style={{ ...badge, ...STATUS_STYLE[cv.status] }}>
              {cv.status}
            </span>
          </button>
        ))}

        {selected && (
          <section
            style={{
              marginTop: "2rem",
              paddingTop: "1.5rem",
              borderTop: "2px solid #eef1f6",
            }}
          >
            <h2 style={{ ...title, fontSize: "1.15rem" }}>
              {selected.originalFilename}
            </h2>
            <p style={{ margin: "0 0 1rem" }}>
              <span style={{ ...badge, ...STATUS_STYLE[selected.status] }}>
                {selected.status}
              </span>{" "}
              {wasCorrected && (
                <span
                  style={{
                    ...badge,
                    background: "#ede9fe",
                    color: "#5b21b6",
                  }}
                >
                  corrected by you
                </span>
              )}
              {!wasCorrected && confidence === "low" && (
                <span
                  style={{ ...badge, background: "#fef3c7", color: "#92400e" }}
                >
                  low confidence — please review
                </span>
              )}
              {!wasCorrected && confidence === "medium" && (
                <span
                  style={{ ...badge, background: "#dcfce7", color: "#166534" }}
                >
                  auto-extracted
                </span>
              )}
            </p>

            {selected.status === "failed" && (
              <div role="alert" style={errorBox}>
                Parsing failed: {selected.errorMessage ?? "unknown error."}{" "}
                You can still correct the fields manually below.
              </div>
            )}

            {!editing && effective && (
              <div>
                <div style={{ ...fieldRow, borderTop: "1px solid #eef1f6" }}>
                  <span style={fieldLabel}>Name</span>
                  <span style={fieldValue}>{effective.name ?? "—"}</span>
                </div>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Email</span>
                  <span style={fieldValue}>{effective.email ?? "—"}</span>
                </div>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Phone</span>
                  <span style={fieldValue}>{effective.phone ?? "—"}</span>
                </div>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Experience</span>
                  <span style={fieldValue}>
                    {effective.experienceYears === null
                      ? "—"
                      : `${effective.experienceYears} year${
                          effective.experienceYears === 1 ? "" : "s"
                        }`}
                  </span>
                </div>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Skills</span>
                  <span style={fieldValue}>
                    {effective.skills.length > 0
                      ? effective.skills.join(", ")
                      : "—"}
                  </span>
                </div>
                <div style={fieldRow}>
                  <span style={fieldLabel}>Education</span>
                  <span style={fieldValue}>
                    {effective.education.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                        {effective.education.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                <details style={{ marginTop: "1rem" }}>
                  <summary
                    style={{ cursor: "pointer", color: "#4F7CFF", fontWeight: 600 }}
                  >
                    View extracted raw text
                  </summary>
                  <pre
                    style={{
                      maxHeight: 240,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "0.8rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    {selected.parsedJson
                      ? "(stored with the parsed fields)"
                      : "No text extracted."}
                  </pre>
                </details>
                <p style={{ ...subtitle, fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Note: the full raw text is kept server-side for future
                  interview personalization; only the extracted fields are
                  shown here.
                </p>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    style={{ ...secondaryButton, marginTop: "1rem" }}
                    onClick={() => startEditing(selected)}
                  >
                    Correct fields
                  </button>
                  <button
                    type="button"
                    style={{ ...dangerButton, marginTop: "1rem" }}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete CV"}
                  </button>
                </div>
              </div>
            )}

            {editing && (
              <form onSubmit={handleSave} noValidate>
                <label style={label} htmlFor="cv-edit-name">
                  Name
                </label>
                <input
                  id="cv-edit-name"
                  style={input}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={saving}
                />
                <label style={label} htmlFor="cv-edit-email">
                  Email
                </label>
                <input
                  id="cv-edit-email"
                  style={input}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={saving}
                />
                <label style={label} htmlFor="cv-edit-phone">
                  Phone
                </label>
                <input
                  id="cv-edit-phone"
                  style={input}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  disabled={saving}
                />
                <label style={label} htmlFor="cv-edit-exp">
                  Years of experience
                </label>
                <input
                  id="cv-edit-exp"
                  style={input}
                  type="number"
                  min={0}
                  max={60}
                  step="0.5"
                  value={editExp}
                  onChange={(e) => setEditExp(e.target.value)}
                  disabled={saving}
                />
                <label style={label} htmlFor="cv-edit-skills">
                  Skills (one per line)
                </label>
                <textarea
                  id="cv-edit-skills"
                  style={textarea}
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  disabled={saving}
                />
                <label style={label} htmlFor="cv-edit-education">
                  Education (one per line)
                </label>
                <textarea
                  id="cv-edit-education"
                  style={textarea}
                  value={editEducation}
                  onChange={(e) => setEditEducation(e.target.value)}
                  disabled={saving}
                />
                {saveError && (
                  <div role="alert" style={errorBox}>
                    {saveError}
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="submit"
                    style={saving ? buttonDisabled : button}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save corrections"}
                  </button>
                  <button
                    type="button"
                    style={{ ...secondaryButton, marginTop: "1.25rem" }}
                    onClick={() => {
                      setEditing(false);
                      setSaveError(null);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <p style={footerText}>
          <Link to="/dashboard" style={link}>
            ← Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
