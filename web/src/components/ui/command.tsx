"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { Kbd } from "./button";

export type Command = { id: string; group: string; label: string; icon: IconName; hint?: string; kbd?: string; run: () => void };

/**
 * Ctrl/⌘K. Opens and closes with no animation: it's used many times a day.
 * Arrow keys move, Enter runs, Esc closes.
 */
export function CommandPalette({
  commands,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: {
  commands: Command[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const openRef = useRef(open);
  const changeRef = useRef(onOpenChange);
  useEffect(() => {
    openRef.current = open;
    changeRef.current = onOpenChange;
  });
  const setOpen = (next: boolean) => {
    setOpenState(next);
    changeRef.current?.(next);
  };
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!openRef.current);
        setQuery("");
        setActive(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 12);
  }, [commands, query]);

  function run(i: number) {
    const c = results[i];
    if (!c) return;
    setOpen(false);
    c.run();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {!hideTrigger && <Dialog.Trigger className="iv-btn iv-btn--secondary" style={{ width: 300, justifyContent: "flex-start", color: "var(--text-2)" }}>
        <Icon name="search" />
        <span style={{ flex: 1, textAlign: "left", fontWeight: 400 }}>Search or type a command</span>
        <Kbd>Ctrl K</Kbd>
      </Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Backdrop className="iv-palette-backdrop" />
        <Dialog.Popup className="iv-palette" aria-label="Command palette">
          <div className="iv-palette-in">
            <Icon name="search" />
            <input
              autoFocus
              value={query}
              placeholder="Search or type a command"
              aria-label="Search"
              role="combobox"
              aria-expanded="true"
              aria-controls="iv-palette-list"
              aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(results.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  run(active);
                }
              }}
            />
            <Kbd>Esc</Kbd>
          </div>
          <div className="iv-palette-list" id="iv-palette-list" role="listbox">
            {results.length === 0 && <div className="iv-palette-group">Nothing found. Try an invoice number or a customer&apos;s name.</div>}
            {results.map((c, i) => {
              const header = c.group !== results[i - 1]?.group ? <div className="iv-palette-group">{c.group}</div> : null;
              return (
                <div key={c.id}>
                  {header}
                  <div
                    id={`cmd-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    className="iv-palette-item"
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(i)}
                  >
                    <Icon name={c.icon} />
                    <b>{c.label}</b>
                    {c.hint && <span className="iv-right iv-num">{c.hint}</span>}
                    {c.kbd && <span className="iv-right"><Kbd>{c.kbd}</Kbd></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
