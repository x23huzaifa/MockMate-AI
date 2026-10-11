/**
 * Job profiles page (/jobs, protected).
 *
 * CRUD for the roles the user practices for. A profile feeds the interview
 * setup: its title + required skills steer question selection.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
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
  title as titleStyle,
} from "./styles";

interface JobProfile {
  id: number;
  title: string;
  company: string | null;
  description: string | null;
  requiredSkills: string[];
  createdAt: string;
}

const listItem: React.CSSProperties = {
  border: "1px solid #e6eaf2",
  borderRadius: 10,
  padding: "0.9rem 1rem",
  marginBottom: "0.75rem",
  background: "#ffffff",
};

const smallButton: React.CSSProperties = {
  padding: "0.35rem 0.8rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontFamily: "inherit",
};

const dangerButton: React.CSSProperties = {
  ...smallButton,
  color: "#b91c1c",
  borderColor: "#fecaca",
};

export default function JobProfiles() {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ jobProfiles: JobProfile[] }>(
        "/api/v1/job-profiles"
      );
      setProfiles(data.jobProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setTitle("");
    setCompany("");
    setDescription("");
    setSkillsText("");
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(p: JobProfile) {
    setEditingId(p.id);
    setTitle(p.title);
    setCompany(p.company ?? "");
    setDescription(p.description ?? "");
    setSkillsText(p.requiredSkills.join(", "));
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const requiredSkills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const payload = {
      title: title.trim(),
      company: company.trim() || null,
      description: description.trim() || null,
      requiredSkills,
    };
    setSaving(true);
    try {
      if (editingId === null) {
        await api("/api/v1/job-profiles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/v1/job-profiles/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this job profile? Interviews keep working — the link is simply removed.")) {
      return;
    }
    try {
      await api(`/api/v1/job-profiles/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 680 }}>
        <h1 style={titleStyle}>Job profiles</h1>
        <p style={subtitle}>
          Describe the role you are preparing for. Its title and skills steer
          which interview questions you get.
        </p>

        <form onSubmit={handleSubmit}>
          <h2 style={{ ...titleStyle, fontSize: "1.15rem" }}>
            {editingId === null ? "New profile" : "Edit profile"}
          </h2>
          <label style={label} htmlFor="jp-title">Job title *</label>
          <input
            id="jp-title"
            style={input}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Frontend Developer"
            required
          />
          <label style={label} htmlFor="jp-company">Company (optional)</label>
          <input
            id="jp-company"
            style={input}
            value={company}
            maxLength={255}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Systems Ltd"
          />
          <label style={label} htmlFor="jp-desc">Description (optional)</label>
          <textarea
            id="jp-desc"
            style={{ ...input, minHeight: 80, resize: "vertical" }}
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the role involves…"
          />
          <label style={label} htmlFor="jp-skills">
            Required skills (optional, comma-separated)
          </label>
          <input
            id="jp-skills"
            style={input}
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="e.g. React, TypeScript, REST APIs"
          />
          {formError && <div style={errorBox}>{formError}</div>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="submit"
              style={saving ? buttonDisabled : button}
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingId === null
                  ? "Create profile"
                  : "Save changes"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                style={{ ...button, background: "#ffffff", color: "#182033", border: "1px solid #cbd5e1" }}
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <h2 style={{ ...titleStyle, fontSize: "1.15rem", marginTop: "2rem" }}>
          My profiles
        </h2>
        {loading && <p style={subtitle}>Loading…</p>}
        {error && <div style={errorBox}>{error}</div>}
        {!loading && !error && profiles.length === 0 && (
          <p style={subtitle}>No job profiles yet — create one above.</p>
        )}
        {profiles.map((p) => (
          <div key={p.id} style={listItem}>
            <div style={{ fontWeight: 700 }}>{p.title}</div>
            {p.company && (
              <div style={{ fontSize: "0.9rem", color: "#64748B" }}>{p.company}</div>
            )}
            {p.requiredSkills.length > 0 && (
              <div style={{ fontSize: "0.85rem", color: "#4F7CFF", marginTop: "0.25rem" }}>
                {p.requiredSkills.join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button type="button" style={smallButton} onClick={() => startEdit(p)}>
                Edit
              </button>
              <button
                type="button"
                style={dangerButton}
                onClick={() => void handleDelete(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <p style={footerText}>
          <Link to="/dashboard" style={link}>← Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
