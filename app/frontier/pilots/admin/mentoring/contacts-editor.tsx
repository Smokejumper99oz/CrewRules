"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Save, X, BookUser } from "lucide-react";
import { upsertMentoringContactCard, deleteMentoringContactCard } from "./actions";

const ICON_OPTIONS = [
  { key: "users",  label: "People / Mentorship" },
  { key: "shield", label: "Military / Benefits" },
  { key: "dollar", label: "Payroll / Compensation" },
  { key: "phone",  label: "Phone / Support" },
  { key: "mail",   label: "Email / Communications" },
  { key: "book",   label: "Reference / Contacts" },
];

type ContactEntry = { label: string; value: string; href?: string };

type ContactCard = {
  id: string;
  title: string;
  subtitle: string;
  icon_key: string;
  sort_order: number;
  entries: ContactEntry[];
};

type EditingState = {
  id: string | null;
  title: string;
  subtitle: string;
  icon_key: string;
  sort_order: number;
  entries: ContactEntry[];
};

const BLANK_EDIT: EditingState = {
  id: null,
  title: "",
  subtitle: "",
  icon_key: "users",
  sort_order: 0,
  entries: [],
};

function blankEntry(): ContactEntry { return { label: "", value: "", href: "" }; }

export function ContactsEditor({ initialCards }: { initialCards: ContactCard[] }) {
  const [cards, setCards] = useState<ContactCard[]>(initialCards);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startNew() {
    setSubmitError(null);
    setEditing({ ...BLANK_EDIT, sort_order: cards.length + 1 });
  }

  function startEdit(card: ContactCard) {
    setSubmitError(null);
    setEditing({
      id: card.id,
      title: card.title,
      subtitle: card.subtitle,
      icon_key: card.icon_key,
      sort_order: card.sort_order,
      entries: card.entries.map((e) => ({ ...e, href: e.href ?? "" })),
    });
  }

  function cancel() {
    setEditing(null);
    setSubmitError(null);
  }

  function addEntry() {
    if (!editing) return;
    setEditing({ ...editing, entries: [...editing.entries, blankEntry()] });
  }

  function removeEntry(i: number) {
    if (!editing) return;
    setEditing({ ...editing, entries: editing.entries.filter((_, idx) => idx !== i) });
  }

  function setEntry(i: number, field: keyof ContactEntry, value: string) {
    if (!editing) return;
    const updated = editing.entries.map((e, idx) => idx === i ? { ...e, [field]: value } : e);
    setEditing({ ...editing, entries: updated });
  }

  function handleSave() {
    if (!editing) return;
    setSubmitError(null);

    const cleanedEntries: ContactEntry[] = editing.entries
      .filter((e) => e.label.trim() || e.value.trim())
      .map((e) => {
        const out: ContactEntry = { label: e.label.trim(), value: e.value.trim() };
        const href = e.href?.trim();
        if (href) out.href = href;
        return out;
      });

    const fd = new FormData();
    if (editing.id) fd.append("id", editing.id);
    fd.append("title", editing.title.trim());
    fd.append("subtitle", editing.subtitle.trim());
    fd.append("icon_key", editing.icon_key);
    fd.append("sort_order", String(editing.sort_order));
    fd.append("entries", JSON.stringify(cleanedEntries));

    startTransition(async () => {
      const result = await upsertMentoringContactCard(fd);
      if (result?.error) {
        setSubmitError(result.error);
        return;
      }

      const saved: ContactCard = {
        id: editing.id ?? "__new__",
        title: editing.title.trim(),
        subtitle: editing.subtitle.trim(),
        icon_key: editing.icon_key,
        sort_order: editing.sort_order,
        entries: cleanedEntries,
      };

      if (editing.id) {
        setCards((prev) => prev.map((c) => (c.id === editing.id ? { ...saved, id: c.id } : c)));
      } else {
        setCards((prev) => [...prev, saved].sort((a, b) => a.sort_order - b.sort_order));
      }
      setEditing(null);
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    const fd = new FormData();
    fd.append("id", id);

    startTransition(async () => {
      const result = await deleteMentoringContactCard(fd);
      setDeletingId(null);
      if (result?.error) {
        setSubmitError(result.error);
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-sm" aria-labelledby="contacts-edit-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="contacts-edit-heading" className="text-base font-semibold text-[#1a2b4b] flex items-center gap-2">
            <BookUser className="h-4 w-4 text-slate-400" aria-hidden />
            Important Contacts — Admin Editor
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the contact cards shown to Frontier pilots on their Important Contacts page. Changes are visible immediately after saving.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add Card
          </button>
        )}
      </div>

      {submitError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {submitError}
        </div>
      )}

      {/* Edit / Create form */}
      {editing && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {editing.id ? "Edit Contact Card" : "New Contact Card"}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Title *</span>
              <input
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="e.g. ALPA Mentorship Program"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Subtitle</span>
              <input
                type="text"
                value={editing.subtitle}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                placeholder="Short description shown under the title"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Icon</span>
              <select
                value={editing.icon_key}
                onChange={(e) => setEditing({ ...editing, icon_key: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500/60 focus:outline-none"
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Sort Order</span>
              <input
                type="number"
                value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value, 10) || 0 })}
                min={0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Entries</span>
              <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                <Plus className="h-3 w-3" aria-hidden />
                Add Row
              </button>
            </div>

            {editing.entries.length === 0 && (
              <p className="text-xs text-slate-600 italic">No entries yet — click "Add Row" to add one.</p>
            )}

            {editing.entries.map((entry, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={entry.label}
                  onChange={(e) => setEntry(i, "label", e.target.value)}
                  placeholder="Label"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                />
                <input
                  type="text"
                  value={entry.value}
                  onChange={(e) => setEntry(i, "value", e.target.value)}
                  placeholder="Display value"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                />
                <input
                  type="url"
                  value={entry.href ?? ""}
                  onChange={(e) => setEntry(i, "href", e.target.value)}
                  placeholder="URL (optional)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                  aria-label="Remove entry"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          {/* Form actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !editing.title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/30 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-700/60 disabled:opacity-40 disabled:pointer-events-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cards list */}
      {cards.length === 0 && !editing ? (
        <p className="text-sm text-slate-500 italic">No contact cards yet. Click "Add Card" to create the first one.</p>
      ) : (
        <div className="space-y-2">
          {cards
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((card) => (
              <div
                key={card.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{card.title}</div>
                  {card.subtitle && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{card.subtitle}</div>
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    {card.entries.length} {card.entries.length === 1 ? "entry" : "entries"} · sort {card.sort_order}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(card)}
                    disabled={!!editing || isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-600/40 bg-slate-700/30 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700/60 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(card.id)}
                    disabled={!!editing || isPending || deletingId === card.id}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    {deletingId === card.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
