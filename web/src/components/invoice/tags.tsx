"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

/** A tag chip in a calm tint picked from its name, so the same tag always looks the same. */
export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="tag-chip">
      {tag}
      {onRemove && (
        <button type="button" aria-label={`Remove tag ${tag}`} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

/**
 * Edit tags in place: type and press Enter (or comma) to add, Backspace on an empty field removes the last,
 * and suggestions come from tags already used in the workspace.
 */
export function TagEditor({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const has = (t: string) => value.some((x) => x.toLowerCase() === t.toLowerCase());
  const matches = suggestions.filter((s) => !has(s) && (!draft.trim() || s.toLowerCase().includes(draft.trim().toLowerCase()))).slice(0, 6);

  function add(t: string) {
    const tag = t.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!tag || has(tag) || value.length >= 10) return setDraft("");
    onChange([...value, tag]);
    setDraft("");
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <div className="tag-ed">
      {value.map((t) => <TagChip key={t} tag={t} onRemove={() => onChange(value.filter((x) => x !== t))} />)}
      {adding ? (
        <span className="tag-in">
          <input
            ref={input}
            autoFocus
            value={draft}
            maxLength={24}
            placeholder={value.length ? "Add another" : "e.g. Q4 or Website"}
            aria-label="Add a tag"
            onChange={(e) => setDraft(e.target.value.replace(",", ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
              if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setDraft(""); }
              if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => setTimeout(() => { if (draft.trim()) add(draft); setAdding(false); }, 120)}
          />
          {matches.length > 0 && (
            <span className="tag-sug" role="listbox" aria-label="Tags you've used">
              {matches.map((m) => (
                <button key={m} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => add(m)}>{m}</button>
              ))}
            </span>
          )}
        </span>
      ) : (
        <button type="button" className="tag-add" onClick={() => setAdding(true)}>
          <Icon name="plus" size={12} />
          {value.length ? "Tag" : "Add a tag"}
        </button>
      )}
    </div>
  );
}
