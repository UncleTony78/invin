"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { InVinMark } from "@/components/brand/mark";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";
import { ANSWER_KEYS, BANK_FIELDS, CURRENCIES, validateAnswer, type AnswerKey, type Answers, type Bank } from "@/lib/onboarding";
import { finishOnboarding, saveAnswer } from "@/server/onboarding-actions";

/* ---------------- The script ---------------- */

type A = Partial<Answers>;
const first = (a: A) => (a.name ?? "").trim().split(/\s+/)[0] || "there";
const cur = (a: A) => a.currency ?? "USD";

const ASK: Record<AnswerKey, (a: A) => string[]> = {
  name: () => ["Hi, I'm here to get InVin ready for you. It takes about a minute.", "First, what's your name?"],
  business: (a) => [`Nice to meet you, ${first(a)}.`, "What's your business called? If you work under your own name, that works too."],
  work: () => ["What do you invoice for? Pick everything that fits.", "These become your invoice categories, so you can see what earns the most."],
  currency: () => ["Which currency do you bill in most? You can still send invoices in others."],
  email: () => ["Which email should customers reply to? It's printed on every invoice."],
  address: () => ["Where is the business based? It goes on your invoices. A city and country is enough."],
  bank: (a) => [`Last one. Where should customers send ${cur(a)} payments?`, "Add a bank account now, or skip it and add one later in Settings."],
};

const EDIT_ASK: Record<AnswerKey, string> = {
  name: "What should I call you instead?",
  business: "What's the right business name?",
  work: "Which categories should we use?",
  currency: "Which currency should be the main one?",
  email: "Which email should customers reply to?",
  address: "What's the right address?",
  bank: "Sure, let's update the bank details.",
};

const LABEL: Record<AnswerKey, string> = {
  name: "Your name",
  business: "Business name",
  work: "Categories",
  currency: "Main currency",
  email: "Reply-to email",
  address: "Address",
  bank: "Bank account",
};

const WORK = ["Design", "Development", "Writing", "Consulting", "Marketing", "Photography", "Video", "Content", "Retainer", "Training"];

const ending = (b: Bank) => {
  const row = b.rows.find(([k]) => /number|iban/i.test(k)) ?? b.rows.find(([, v]) => v.trim());
  const v = row?.[1].replace(/\s/g, "") ?? "";
  return v.length > 4 ? `ending ${v.slice(-4)}` : v;
};

function shown(key: AnswerKey, a: A, forSummary = false): string {
  const v = a[key];
  if (key === "currency") {
    const c = CURRENCIES.find((x) => x.value === v);
    return c ? `${c.label} (${c.value})` : "";
  }
  if (key === "address") return (v as string) || (forSummary ? "Not added" : "Skip for now");
  if (key === "work") {
    const list = Array.isArray(v) ? v : v ? [String(v)] : [];
    return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : (list[0] ?? "");
  }
  if (key === "bank") return v ? `${(v as Bank).bank}, account ${ending(v as Bank)}` : forSummary ? "Not added yet" : "I'll add it later";
  return String(v ?? "");
}

/* ---------------- Messages ---------------- */

type Save = "saving" | "saved" | "error";
type Msg =
  | { id: string; from: "bot"; text: string }
  | { id: string; from: "bot"; summary: A; live: boolean }
  | { id: string; from: "me"; text: string; key?: AnswerKey; save?: Save; value?: unknown };
type Line = string | { summary: true };
type Asking = AnswerKey | "summary" | "change" | "done" | null;

const uid = () => Math.random().toString(36).slice(2);
const nextKey = (a: A, after?: AnswerKey) => ANSWER_KEYS.slice(after ? ANSWER_KEYS.indexOf(after) + 1 : 0).find((k) => a[k] === undefined);

/** Rebuild the conversation so far from saved answers, so a refresh shows where they were. */
function history(saved: A): Msg[] {
  const out: Msg[] = [];
  const a: A = {};
  for (const key of ANSWER_KEYS) {
    if (saved[key] === undefined) break;
    ASK[key](a).forEach((text, i) => out.push({ id: `h-${key}-${i}`, from: "bot", text }));
    (a as Record<string, unknown>)[key] = saved[key];
    out.push({ id: `h-${key}-me`, from: "me", text: shown(key, a), key, save: "saved" });
  }
  return out;
}

export function WelcomeChat({ signInEmail, saved }: { signInEmail: string; saved: A }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [answers, setAnswers] = useState<A>(saved);
  const [messages, setMessages] = useState<Msg[]>(() => history(saved));
  const [typing, setTyping] = useState(false);
  const [asking, setAsking] = useState<Asking>(null);
  const [editing, setEditing] = useState(false);
  const timers = useRef<number[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  const answered = ANSWER_KEYS.filter((k) => answers[k] !== undefined).length;

  /* Bot speaks: a typing indicator, then each line, paced by its length. */
  function say(lines: Line[], then: Asking, wait = 250) {
    setAsking(null);
    let t = wait;
    lines.forEach((line, i) => {
      const len = typeof line === "string" ? line.length : 40;
      timers.current.push(window.setTimeout(() => setTyping(true), t));
      t += reduce ? 120 : Math.min(1000, 320 + len * 8);
      timers.current.push(
        window.setTimeout(() => {
          setTyping(false);
          setMessages((m) =>
            typeof line === "string"
              ? [...m, { id: uid(), from: "bot", text: line }]
              : [...m.map((x) => ("summary" in x ? { ...x, live: false } : x)), { id: uid(), from: "bot", summary: {}, live: true }],
          );
          if (i === lines.length - 1) setAsking(then);
        }, t),
      );
      t += reduce ? 40 : 160;
    });
  }

  const summaryLines = (a: A): Line[] => [`Thanks, ${first(a)}. Here's everything I have.`, { summary: true }, "Is all of this correct?"];

  function askNext(a: A, after?: AnswerKey) {
    const k = editing ? undefined : nextKey(a, after);
    if (editing || !k) {
      setEditing(false);
      return say(editing ? ["Updated.", ...summaryLines(a).slice(1)] : summaryLines(a), "summary");
    }
    say(ASK[k](a), k);
  }

  // Start (or resume) the conversation once, after first paint
  useEffect(() => {
    const t = window.setTimeout(() => {
      const k = nextKey(saved);
      const resumed = ANSWER_KEYS.some((x) => saved[x] !== undefined);
      if (!k) say(["Welcome back.", ...summaryLines(saved)], "summary", 300);
      else if (resumed) say(["Welcome back. Let's pick up where you left off.", ...ASK[k](saved).slice(-1)], k, 300);
      else say(ASK[k](saved), k, 450);
    }, 0);
    const pending = timers.current;
    return () => {
      // Dev mode mounts twice: cancel everything so the second mount starts cleanly
      clearTimeout(t);
      pending.forEach(clearTimeout);
      pending.length = 0;
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount by design
  }, []);

  // Keep the newest message in view
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, typing, asking, reduce]);

  async function persist(id: string, key: AnswerKey, value: unknown) {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, save: "saving" } : x)));
    const res = await saveAnswer(key, value as never).catch(() => ({ ok: false as const, error: "" }));
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, save: res.ok ? "saved" : "error" } : x)));
  }

  function answer<K extends AnswerKey>(key: K, value: Answers[K]) {
    const a = { ...answers, [key]: value };
    setAnswers(a);
    const id = uid();
    setMessages((m) => [...m, { id, from: "me", text: shown(key, a), key, save: "saving", value }]);
    void persist(id, key, value);
    askNext(a, key);
  }

  function startChange(key: AnswerKey, fromChips: boolean) {
    setEditing(true);
    if (!fromChips) setMessages((m) => [...m, { id: uid(), from: "me", text: `Change my ${LABEL[key].toLowerCase().replace("your ", "")}` }]);
    else setMessages((m) => [...m, { id: uid(), from: "me", text: LABEL[key] }]);
    say([EDIT_ASK[key]], key, 200);
  }

  async function confirm() {
    setMessages((m) => [...m.map((x) => ("summary" in x ? { ...x, live: false } : x)), { id: uid(), from: "me", text: "Yes, that's all correct" }]);
    setAsking("done");
    setTyping(true);
    const [res] = await Promise.all([finishOnboarding().catch(() => ({ ok: false as const, error: "" })), new Promise((r) => setTimeout(r, reduce ? 200 : 900))]);
    setTyping(false);
    if (!res.ok) {
      setMessages((m) => [...m, { id: uid(), from: "bot", text: `I couldn't finish setting up. ${res.error || "Check your connection and try again."}` }]);
      return setAsking("summary");
    }
    setMessages((m) => [...m, { id: uid(), from: "bot", text: `All set, ${first(answers)}. ${answers.business} is ready. Taking you in now.` }]);
    window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, reduce ? 300 : 1100);
  }

  const lastSummary = [...messages].reverse().find((m) => "summary" in m)?.id;

  return (
    <div className="wc">
      <header className="wc-top">
        <InVinMark size={24} />
        <div className="wc-prog" aria-label={`${answered} of ${ANSWER_KEYS.length} answered`}>
          <span>Setting up your workspace</span>
          <i><motion.b initial={false} animate={{ scaleX: asking === "done" ? 1 : answered / ANSWER_KEYS.length }} transition={{ type: "spring", bounce: 0, duration: 0.5 }} /></i>
        </div>
        <button
          type="button"
          className="wc-out"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/sign-in");
          }}
        >
          Sign out
        </button>
      </header>

      <div className="wc-scroll" ref={scroller}>
        <ol className="wc-log" aria-live="polite">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.from === m.from;
            return (
              <motion.li
                key={m.id}
                className={m.from === "me" ? "wc-me" : "wc-bot"}
                data-grouped={grouped || undefined}
                initial={m.id.startsWith("h-") ? false : m.from === "me" ? (reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }) : reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.38 }}
              >
                {m.from === "bot" && !grouped && <span className="wc-av"><InVinMark size={20} /></span>}
                {"summary" in m ? (
                  <Summary a={answers} live={m.live && m.id === lastSummary && asking === "summary"} onChange={(k) => startChange(k, false)} />
                ) : m.from === "me" ? (
                  <div className="wc-bub">
                    <p>{m.text}</p>
                    {m.save && (
                      <small data-s={m.save}>
                        {m.save === "saving" && "Saving…"}
                        {m.save === "saved" && <><Icon name="check" size={12} />Saved</>}
                        {m.save === "error" && (
                          <button type="button" onClick={() => m.key && persist(m.id, m.key, m.value ?? answers[m.key])}>
                            Not saved. Try again
                          </button>
                        )}
                      </small>
                    )}
                  </div>
                ) : (
                  <p className="wc-say">{m.text}</p>
                )}
              </motion.li>
            );
          })}
          {typing && (
            <li className="wc-bot" data-grouped={messages.at(-1)?.from === "bot" || undefined}>
              {messages.at(-1)?.from !== "bot" && <span className="wc-av"><InVinMark size={20} /></span>}
              <span className="wc-dots" aria-label="Typing"><i /><i /><i /></span>
            </li>
          )}
        </ol>
      </div>

      <div className="wc-dock">
        <AnimatePresence mode="wait" initial={false}>
          {asking && asking !== "done" && (
            <motion.div
              key={asking + (editing ? "-edit" : "")}
              className="wc-comp"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              {asking === "name" && <TextReply placeholder="Your name" autoComplete="name" onSend={(v) => answer("name", v)} k="name" initial={answers.name} />}
              {asking === "business" && (
                <TextReply placeholder="Business name" autoComplete="organization" k="business" initial={answers.business} suggestions={answers.name ? [{ label: `Use my name, ${answers.name}`, value: answers.name }] : []} onSend={(v) => answer("business", v)} />
              )}
              {asking === "work" && <MultiChoices initial={Array.isArray(answers.work) ? answers.work : []} options={WORK} onDone={(v) => answer("work", v)} />}
              {asking === "currency" && <Choices k="currency" options={CURRENCIES.map((c) => ({ value: c.value, label: `${c.symbol}  ${c.label}` }))} onPick={(v) => answer("currency", v)} />}
              {asking === "email" && (
                <TextReply type="email" placeholder="you@business.com" autoComplete="email" k="email" initial={answers.email} suggestions={[{ label: `Use ${signInEmail}`, value: signInEmail }]} onSend={(v) => answer("email", v)} />
              )}
              {asking === "address" && <TextReply placeholder="e.g. Lekki, Lagos, Nigeria" autoComplete="street-address" k="address" initial={answers.address} onSend={(v) => answer("address", v)} onSkip={() => answer("address", "")} />}
              {asking === "bank" && <BankReply currency={cur(answers)} initial={answers.bank ?? null} onSend={(b) => answer("bank", b)} onSkip={() => answer("bank", null)} />}
              {asking === "summary" && (
                <div className="wc-acts">
                  <Button variant="primary" icon="check" onClick={confirm}>Yes, that&apos;s all correct</Button>
                  <Button
                    onClick={() => {
                      setMessages((m) => [...m.map((x) => ("summary" in x ? { ...x, live: false } : x)), { id: uid(), from: "me", text: "I need to change something" }]);
                      say(["No problem. What would you like to change?"], "change", 200);
                    }}
                  >
                    Change something
                  </Button>
                </div>
              )}
              {asking === "change" && (
                <div className="wc-chips">
                  {ANSWER_KEYS.map((k) => (
                    <button key={k} type="button" className="wc-chip" onClick={() => startChange(k, true)}>{LABEL[k]}</button>
                  ))}
                  <button
                    type="button"
                    className="wc-chip"
                    data-quiet
                    onClick={() => {
                      setMessages((m) => [...m, { id: uid(), from: "me", text: "Actually, it's all fine" }]);
                      say(summaryLines(answers).slice(1), "summary", 200);
                    }}
                  >
                    Never mind
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------- Summary card ---------------- */

function Summary({ a, live, onChange }: { a: A; live: boolean; onChange: (k: AnswerKey) => void }) {
  return (
    <div className="wc-sum" data-live={live || undefined}>
      <dl>
        {ANSWER_KEYS.map((k) => (
          <div key={k}>
            <dt>{LABEL[k]}</dt>
            <dd data-empty={(k === "address" && !a.address) || (k === "bank" && !a.bank) || undefined}>{shown(k, a, true)}</dd>
            {live && (
              <button type="button" onClick={() => onChange(k)} aria-label={`Change ${LABEL[k].toLowerCase()}`}>
                Change
              </button>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------- Reply composers ---------------- */

function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button type="submit" className="wc-send" disabled={disabled} aria-label="Send">
      <Icon name="up" size={18} />
    </button>
  );
}

function TextReply({
  k, placeholder, type = "text", autoComplete, suggestions = [], initial, onSend, onSkip,
}: {
  k: AnswerKey; placeholder: string; type?: string; autoComplete?: string; suggestions?: { label: string; value: string }[]; initial?: string; onSend: (v: string) => void; onSkip?: () => void;
}) {
  const [v, setV] = useState(initial ?? "");
  const [error, setError] = useState("");
  function send(value: string) {
    const problem = validateAnswer(k, value);
    if (problem) return setError(problem);
    onSend(value.trim());
  }
  return (
    <>
      {(suggestions.length > 0 || onSkip) && (
        <div className="wc-chips">
          {suggestions.map((s) => (
            <button key={s.value} type="button" className="wc-chip" onClick={() => send(s.value)}>{s.label}</button>
          ))}
          {onSkip && <button type="button" className="wc-chip" data-quiet onClick={onSkip}>Skip for now</button>}
        </div>
      )}
      <form
        className="wc-field"
        data-error={error || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          send(v);
        }}
      >
        <input
          autoFocus
          type={type}
          value={v}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-label={placeholder}
          aria-invalid={!!error || undefined}
          onChange={(e) => {
            setV(e.target.value);
            setError("");
          }}
        />
        <SendButton disabled={!v.trim()} />
      </form>
      {error && <p className="wc-err" role="alert"><Icon name="alert" size={14} />{error}</p>}
    </>
  );
}

function Choices({ k, options, other, onPick }: { k: AnswerKey; options: { value: string; label: string }[]; other?: string; onPick: (v: string) => void }) {
  const [writing, setWriting] = useState(false);
  if (writing) return <TextReply k={k} placeholder="Describe it in a few words" onSend={onPick} />;
  return (
    <div className="wc-chips" role="group" aria-label="Choose one">
      {options.map((o) => (
        <button key={o.value} type="button" className="wc-chip" onClick={() => onPick(o.value)}>{o.label}</button>
      ))}
      {other && <button type="button" className="wc-chip" data-quiet onClick={() => setWriting(true)}>{other}…</button>}
    </div>
  );
}

function BankReply({ currency, initial, onSend, onSkip }: { currency: string; initial: Bank | null; onSend: (b: Bank) => void; onSkip: () => void }) {
  const fields = BANK_FIELDS[currency] ?? BANK_FIELDS.USD;
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [rows, setRows] = useState<[string, string][]>(fields.map((f) => [f, initial?.rows.find(([k]) => k === f)?.[1] ?? ""]));
  const [error, setError] = useState("");
  return (
    <form
      className="wc-bank"
      onSubmit={(e) => {
        e.preventDefault();
        const b = { bank: bank.trim(), rows };
        const problem = validateAnswer("bank", b);
        if (problem) return setError(problem);
        onSend(b);
      }}
    >
      <div className="wc-bank-grid">
        <label>
          <span>Bank</span>
          <input autoFocus value={bank} placeholder="e.g. Barclays" onChange={(e) => { setBank(e.target.value); setError(""); }} />
        </label>
        {rows.map(([label, val], i) => (
          <label key={label}>
            <span>{label}</span>
            <input
              value={val}
              className={label === "Account name" ? undefined : "iv-mono"}
              inputMode={/number|code/i.test(label) ? "numeric" : undefined}
              onChange={(e) => {
                setRows((r) => r.map((x, n) => (n === i ? [x[0], e.target.value] : x)));
                setError("");
              }}
            />
          </label>
        ))}
      </div>
      {error && <p className="wc-err" role="alert"><Icon name="alert" size={14} />{error}</p>}
      <div className="wc-acts">
        <Button type="submit" variant="primary" icon="check">
          <MorphLabel id="add">Add account</MorphLabel>
        </Button>
        <Button onClick={onSkip}>Skip for now</Button>
      </div>
    </form>
  );
}

/** Pick several, add your own, then continue. Chips toggle in place; nothing is sent until "Continue". */
function MultiChoices({ options, initial, onDone }: { options: string[]; initial: string[]; onDone: (v: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [extra, setExtra] = useState<string[]>(initial.filter((c) => !options.includes(c)));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const all = [...options, ...extra];
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  function add() {
    const c = draft.trim().replace(/\s+/g, " ");
    if (!c) return;
    if (c.length > 30) return setError("Keep it under 30 characters.");
    const existing = all.find((x) => x.toLowerCase() === c.toLowerCase());
    if (!existing) setExtra((e) => [...e, c]);
    setPicked((p) => (p.includes(existing ?? c) ? p : [...p, existing ?? c]));
    setDraft("");
    setError("");
  }
  return (
    <>
      <div className="wc-chips" role="group" aria-label="Pick all that fit">
        {all.map((c) => (
          <button key={c} type="button" className="wc-chip" aria-pressed={picked.includes(c)} onClick={() => toggle(c)}>
            {picked.includes(c) && <Icon name="check" size={14} />}
            {c}
          </button>
        ))}
      </div>
      <form
        className="wc-field"
        data-error={error || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) return add();
          if (!picked.length) return setError("Pick at least one, or add your own.");
          onDone(all.filter((c) => picked.includes(c)));
        }}
      >
        <input value={draft} placeholder="Add your own, then press Enter" aria-label="Add your own category" maxLength={40} onChange={(e) => { setDraft(e.target.value); setError(""); }} />
        {draft.trim() ? (
          <button type="submit" className="wc-send" aria-label="Add category"><Icon name="plus" size={18} /></button>
        ) : (
          <button type="submit" className="wc-continue" disabled={!picked.length}>
            Continue{picked.length ? ` with ${picked.length}` : ""}
          </button>
        )}
      </form>
      {error && <p className="wc-err" role="alert"><Icon name="alert" size={14} />{error}</p>}
    </>
  );
}
