import "@/styles/invoice.css";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { InvoicePaper, TEMPLATES, type PaperInvoice, type Template } from "@/components/invoice/paper";
import type { BankAccount, Business } from "@/lib/sample";
import { C, EIO, EO, MARK_PATH, mono, sans, serif } from "./theme";

/* ---------------- data: the same sample studio the landing page uses ---------------- */
export const BIZ: Business = { name: "Ada Obi Studio", mark: "AO", address: "Admiralty Way, Lekki, Lagos", email: "" };
export const GBP: BankAccount = { id: "gbp", currency: "GBP", bank: "Wise · UK account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "41286650"], ["Sort code", "23-14-70"]] };
export const ITEMS = [
  { description: "Brand identity, phase 2", quantity: 1, price: 1350 },
  { description: "File export and handover", quantity: 5, price: 90 },
  { description: "Social templates, set of 12", quantity: 1, price: 450 },
];
export const INV: PaperInvoice = {
  number: "INV-0145", issued: "Nov 13, 2026", due: "Nov 27, 2026", currency: "GBP",
  customer: { name: "Northstar Advisory", email: "", address: "Shoreditch, London", currency: "GBP" },
  items: ITEMS,
};
export const BRANDS = ["#0E5A52", "#2453B8", "#B93A0B", "#7A4E2D", "#1A1916"];

/* ---------------- helpers ---------------- */
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = (f: number, a: number, b: number, from = 0, to = 1, e = EO) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });

export function Paper({ width, template = "stacked", brand = "#0E5A52", invoice = INV, stamp, style }: { width: number; template?: Template; brand?: string; invoice?: PaperInvoice; stamp?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ width, ...style }}>
      <InvoicePaper invoice={invoice} business={BIZ} account={GBP} template={template} brand={brand} fontSize={(width / 794) * 15.5} stamp={stamp ? { kind: "paid" } : undefined} />
    </div>
  );
}

/* Words that rise out of a mask, one after another */
export function Rise({ text, start, size, weight = 500, color = C.ink, stagger = 3, style }: { text: string; start: number; size: number; weight?: number; color?: string; stagger?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: sans, fontSize: size, fontWeight: weight, lineHeight: 1.02, letterSpacing: "-0.04em", color, display: "flex", flexWrap: "wrap", columnGap: size * 0.24, ...style }}>
      {words.map((w, i) => {
        const p = ease(f, start + i * stagger, start + i * stagger + 18);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, filter: `blur(${(1 - p) * 6}px)`, opacity: 0.2 + p * 0.8 }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

export function Glow({ x = "70%", y = "-10%", size = 1400, opacity = 0.35 }: { x?: string; y?: string; size?: number; opacity?: number }) {
  return <div style={{ position: "absolute", left: x, top: y, width: size, height: size, transform: "translate(-50%,-50%)", borderRadius: "50%", background: `radial-gradient(circle, ${C.tang} 0%, transparent 62%)`, opacity, filter: "blur(40px)" }} />;
}

export function Ground({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: sans, ["--font-mono" as string]: mono, ["--font-serif" as string]: serif, overflow: "hidden" } as CSSProperties}>
      {children}
    </AbsoluteFill>
  );
}

export function Pill({ s }: { s: "draft" | "sent" | "viewed" | "paid" }) {
  const look = { draft: ["#f0efeb", "#55534e", "Draft"], sent: ["#e8effc", "#2453b8", "Sent"], viewed: ["#e2f3f1", "#0e6a63", "Opened"], paid: ["#e3f2e8", "#12713f", "Paid"] }[s];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 44, padding: "0 18px", borderRadius: 999, background: look[0], color: look[1], fontWeight: 500, fontSize: 24 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: look[1] }} />
      {look[2]}
    </span>
  );
}

/* ---------------- 1. the mark builds ---------------- */
export function Logo() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 6, fps, config: { damping: 14, mass: 0.8 } });
  const cut = ease(f, 22, 42);
  const word = ease(f, 30, 52);
  const out = ease(f, 74, 90, 0, 1, EIO);
  return (
    <Ground>
      <Glow x="50%" y="50%" size={1100} opacity={0.18 * s} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 40, opacity: 1 - out, transform: `scale(${1 + out * 0.04})` }}>
        <svg width={220} height={220} viewBox="48 48 160 160" style={{ transform: `scale(${0.6 + s * 0.4}) rotate(${(1 - s) * -12}deg)`, opacity: Math.min(1, s * 1.4) }}>
          <path d={MARK_PATH.split("Z")[0] + "Z"} fill={C.tang} />
          {/* the slot cuts in */}
          <rect x={96 + (1 - cut) * 32} y={88} width={64 * cut} height={26} rx={13} fill={C.bg} />
        </svg>
        <div style={{ fontSize: 190, fontWeight: 600, letterSpacing: "-0.05em", overflow: "hidden", lineHeight: 1 }}>
          <div style={{ transform: `translateY(${(1 - word) * 100}%)`, filter: `blur(${(1 - word) * 8}px)` }}>InVin</div>
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 2. the headline ---------------- */
export function Headline() {
  const f = useCurrentFrame();
  const sub = ease(f, 52, 76);
  return (
    <Ground>
      <Glow x="85%" y="-5%" size={1500} opacity={0.32} />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center" }}>
        <Rise text="Invoicing for freelancers" start={4} size={150} />
        <Rise text="and small studios." start={16} size={150} color={C.muted} />
        <div style={{ marginTop: 56, display: "flex", gap: 22, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)` }}>
          {["9 invoice designs", "4 currencies", "Reminders that send themselves"].map((t, i) => (
            <span key={t} style={{ fontSize: 32, padding: "14px 26px", borderRadius: 999, border: `1px solid ${C.line}`, color: i === 2 ? C.tang : C.ink }}>{t}</span>
          ))}
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 3. the invoice fills in ---------------- */
export function Build() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = f < 40 ? 0 : f < 70 ? 1 : f < 100 ? 2 : 3;
  const paperIn = spring({ frame: f - 4, fps, config: { damping: 18 } });
  const total = ITEMS.slice(0, shown).reduce((s, l) => s + l.quantity * l.price, 0);
  const push = interpolate(f, [0, 200], [1, 1.06], clamp);
  const rows = ITEMS.slice(0, Math.max(1, shown)).map((l, i) => (i < shown ? l : { description: "", quantity: 1, price: 0 }));
  return (
    <Ground>
      <Glow x="20%" y="110%" size={1300} opacity={0.22} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px", gap: 120 }}>
        <div style={{ flex: 1 }}>
          <Rise text="Make it in a minute." start={6} size={104} />
          <p style={{ marginTop: 36, fontSize: 36, lineHeight: 1.4, color: C.muted, maxWidth: 640, opacity: ease(f, 24, 44) }}>Pick the customer, add what you did. Their currency and payment terms fill in for you.</p>
          <div style={{ marginTop: 56, fontFamily: mono, fontSize: 30, color: C.muted, opacity: ease(f, 36, 52) }}>
            Total <span style={{ color: C.ink, fontFamily: sans, fontSize: 64, fontWeight: 500, letterSpacing: "-0.03em", marginLeft: 18 }}>£{total.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div style={{ transform: `translateY(${(1 - paperIn) * 140}px) scale(${push}) rotate(${(1 - paperIn) * 4}deg)`, opacity: paperIn, transformOrigin: "50% 60%" }}>
          <Paper width={520} invoice={{ ...INV, items: rows }} style={{ filter: "drop-shadow(0 50px 80px rgba(0,0,0,.6))" }} />
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 4. sent, opened, paid ---------------- */
export function Lifecycle() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = f < 36 ? "draft" : f < 72 ? "sent" : f < 108 ? "viewed" : "paid";
  const stamp = spring({ frame: f - 112, fps, config: { damping: 11, stiffness: 180 } });
  const bar = ease(f, 112, 140);
  const words: [string, number][] = [["Sent.", 36], ["Opened.", 72], ["Paid.", 108]];
  return (
    <Ground>
      <Glow x="80%" y="10%" size={1500} opacity={0.3} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px", gap: 120 }}>
        <div style={{ flex: 1, display: "grid", gap: 4 }}>
          {words.map(([w, at]) => {
            const p = ease(f, at, at + 16);
            return (
              <div key={w} style={{ fontSize: 150, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1.02, color: w === "Paid." ? C.tang : C.ink, opacity: 0.12 + p * 0.88, transform: `translateX(${(1 - p) * -30}px)` }}>{w}</div>
            );
          })}
          <p style={{ marginTop: 28, fontSize: 32, color: C.muted, opacity: ease(f, 120, 140) }}>You see when it's opened. The receipt goes out by itself.</p>
        </div>
        <div style={{ width: 640, background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 60px 120px -40px rgba(0,0,0,.8)", color: "#1a1916" }}>
          <div style={{ height: 76, display: "flex", alignItems: "center", gap: 16, padding: "0 26px", borderBottom: "1px solid #ebe9e4" }}>
            <span style={{ display: "flex", gap: 9 }}>{[0, 1, 2].map((k) => <i key={k} style={{ width: 14, height: 14, borderRadius: "50%", background: "#dcdad4", display: "block" }} />)}</span>
            <span style={{ fontFamily: mono, fontSize: 24, color: "#5f5d58", marginLeft: 8 }}>INV-0145</span>
            <span style={{ marginLeft: "auto" }}><Pill s={step} /></span>
          </div>
          <div style={{ position: "relative", padding: "24px 24px 0", background: "#f6f5f2", height: 560, overflow: "hidden" }}>
            <Paper width={592} />
            <div style={{ position: "absolute", left: 90, top: 250, padding: "4px 22px", border: "10px solid #12713f", borderRadius: 16, color: "#12713f", fontWeight: 600, fontSize: 92, letterSpacing: "0.12em", background: "rgba(255,255,255,.85)", transform: `rotate(-11deg) scale(${2 - stamp})`, opacity: Math.min(1, stamp * 1.3) }}>PAID</div>
          </div>
          <div style={{ padding: "20px 26px 26px", borderTop: "1px solid #ebe9e4", display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#5f5d58" }}>
              <span>{{ draft: "Not sent yet", sent: "Sent with PDF · Nov 13", viewed: "Opened by Northstar · 2 min ago", paid: "Paid in full · Nov 21" }[step]}</span>
              <b style={{ color: "#1a1916", fontWeight: 500 }}>£2,250.00</b>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: "#ebe9e4", overflow: "hidden" }}><div style={{ height: "100%", width: `${bar * 100}%`, background: C.paid }} /></div>
          </div>
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 5. nine designs, your colours ---------------- */
export function Designs() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brandIdx = Math.min(BRANDS.length - 1, Math.max(0, Math.floor((f - 70) / 22)));
  const brand = f < 70 ? BRANDS[0] : BRANDS[brandIdx];
  const W = 300;
  return (
    <Ground>
      <Glow x="50%" y="120%" size={1800} opacity={0.28} />
      <div style={{ position: "absolute", left: 160, top: 110 }}>
        <Rise text="Nine designs. Your colours." start={2} size={96} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", gap: 28, perspective: 1600 }}>
        {TEMPLATES.slice(0, 5).map((t, i) => {
          const s = spring({ frame: f - 10 - i * 5, fps, config: { damping: 16 } });
          const lift = i === 2 ? 0 : Math.abs(i - 2) * 26;
          return (
            <div key={t.value} style={{ transform: `translateY(${(1 - s) * 260 + lift}px) rotateY(${(i - 2) * -7}deg)`, opacity: s }}>
              <Paper width={W} template={t.value} brand={brand} style={{ filter: "drop-shadow(0 40px 60px rgba(0,0,0,.55))" }} />
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 26, color: C.muted }}>{t.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center", gap: 18, opacity: ease(f, 50, 66) }}>
        {BRANDS.map((c, i) => (
          <span key={c} style={{ width: 40, height: 40, borderRadius: "50%", background: c, boxShadow: i === brandIdx && f >= 70 ? `0 0 0 4px ${C.bg}, 0 0 0 7px ${C.ink}` : "inset 0 0 0 1px rgba(255,255,255,.25)" }} />
        ))}
        <span style={{ marginLeft: 22, fontSize: 26, color: C.muted, alignSelf: "center" }}>+ Ledger, Sidebar, Swiss and Soft</span>
      </div>
    </Ground>
  );
}

/* ---------------- 6. it runs itself ---------------- */
export const NOTES: [string, string, string, string][] = [
  ["Reminder sent to Halden Labs", "3 days before it's due", "#fff1ea", "#b23f0e"],
  ["Halden Labs opened INV-0146", "Just now", "#e2f3f1", "#0e6a63"],
  ["Payment recorded · $1,500.00", "Bank transfer", "#e3f2e8", "#12713f"],
  ["Receipt sent to Northstar", "With the PDF attached", "#e8effc", "#2453b8"],
  ["Retainer invoice INV-0151 sent", "Every month, on the 1st", "#f0efeb", "#55534e"],
];
export function Automation() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Ground>
      <Glow x="90%" y="50%" size={1300} opacity={0.26} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px", gap: 100 }}>
        <div style={{ flex: 1 }}>
          <Rise text="Reminders and receipts send themselves." start={4} size={92} />
          <p style={{ marginTop: 32, fontSize: 34, color: C.muted, opacity: ease(f, 30, 50), maxWidth: 700, lineHeight: 1.4 }}>Polite reminders before and after the due date. They stop the moment you're paid.</p>
        </div>
        <div style={{ width: 640, display: "grid", gap: 18 }}>
          {NOTES.map(([t, s, bg, fg], i) => {
            const p = spring({ frame: f - 14 - i * 16, fps, config: { damping: 15 } });
            return (
              <div key={t} style={{ display: "flex", gap: 20, alignItems: "center", background: "#fff", color: "#1a1916", borderRadius: 22, padding: "22px 26px", boxShadow: "0 30px 60px -30px rgba(0,0,0,.8)", opacity: p, transform: `translateX(${(1 - p) * 140}px) scale(${0.94 + p * 0.06})` }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: "grid", placeItems: "center", flex: "none" }}><span style={{ width: 16, height: 16, borderRadius: "50%", background: fg }} /></span>
                <span><b style={{ display: "block", fontWeight: 500, fontSize: 28 }}>{t}</b><span style={{ fontSize: 22, color: "#5f5d58" }}>{s}</span></span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 7. the real numbers ---------------- */
export function Figures() {
  const f = useCurrentFrame();
  const figs: [number, string][] = [[9, "invoice designs"], [4, "currencies"], [5, "reminder steps"], [60, "seconds to undo a receipt"]];
  return (
    <Ground>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 160px" }}>
        {figs.map(([n, l], i) => {
          const p = ease(f, 6 + i * 8, 40 + i * 8);
          return (
            <div key={l} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ fontSize: 260, fontWeight: 500, letterSpacing: "-0.06em", lineHeight: 1, color: i === 0 ? C.tang : C.ink, fontVariantNumeric: "tabular-nums" }}>{Math.round(n * p)}</div>
              <div style={{ fontSize: 30, color: C.muted, marginTop: 10 }}>{l}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------------- 8. end card ---------------- */
export function End() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 16 } });
  const btn = ease(f, 40, 60);
  return (
    <Ground>
      <Glow x="50%" y="40%" size={1500} opacity={0.3 * s} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `scale(${0.9 + s * 0.1})`, opacity: s }}>
          <svg width={110} height={110} viewBox="48 48 160 160"><path fillRule="evenodd" d={MARK_PATH} fill={C.tang} /></svg>
          <span style={{ fontSize: 110, fontWeight: 600, letterSpacing: "-0.05em" }}>InVin</span>
        </div>
        <Rise text="Send your first invoice today." start={14} size={84} style={{ justifyContent: "center" }} />
        <div style={{ opacity: btn, transform: `translateY(${(1 - btn) * 20}px)`, display: "inline-flex", alignItems: "center", gap: 16, height: 84, padding: "0 40px", borderRadius: 18, background: C.tang, color: C.bg, fontSize: 34, fontWeight: 500 }}>
          Create your account
          <svg width="26" height="26" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 6h8M4.5 2.5 8 6l-3.5 3.5" /></svg>
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

