import type { ReactNode } from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TEMPLATES } from "@/components/invoice/paper";
import { Footage, Notice } from "./broll";
import { BRANDS, Glow, Ground, Paper, Pill, Rise, ease } from "./scenes";
import { SoundLayer, type Cue } from "./sound";
import { C, MARK_PATH, mono } from "./theme";

/* 9:16 cuts for Reels, TikTok and Shorts. Each opens on its hook in the first second. */
const PAD = 90;

function VEnd() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 16 } });
  const btn = ease(f, 36, 56);
  return (
    <Ground>
      <Glow x="50%" y="45%" size={1500} opacity={0.32 * s} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56, padding: `0 ${PAD}px`, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `scale(${0.9 + s * 0.1})`, opacity: s }}>
          <svg width={120} height={120} viewBox="48 48 160 160"><path fillRule="evenodd" d={MARK_PATH} fill={C.tang} /></svg>
          <span style={{ fontSize: 120, fontWeight: 600, letterSpacing: "-0.05em" }}>InVin</span>
        </div>
        <Rise text="Send your first invoice today." start={12} size={88} style={{ justifyContent: "center" }} />
        <div style={{ opacity: btn, transform: `translateY(${(1 - btn) * 20}px)`, height: 104, padding: "0 52px", borderRadius: 22, background: C.tang, color: C.bg, fontSize: 42, fontWeight: 500, display: "inline-flex", alignItems: "center" }}>Create your account</div>
      </AbsoluteFill>
    </Ground>
  );
}

function BigHook({ text, accent, footage }: { text: string; accent?: string; footage: string }) {
  return (
    <Ground>
      <Footage src={footage} dim={0.5} push={0.1} />
      <AbsoluteFill style={{ padding: `0 ${PAD}px`, justifyContent: "center" }}>
        <Rise text={text} start={0} size={150} stagger={2} />
        {accent && <Rise text={accent} start={10} size={150} stagger={2} color={C.tang} />}
      </AbsoluteFill>
    </Ground>
  );
}

/* ---------- A. Stop chasing invoices ---------- */
const REM: [string, string, string, string][] = [
  ["Reminder sent to Halden Labs", "3 days before it's due", "#fff1ea", "#b23f0e"],
  ["Reminder sent to Halden Labs", "On the due date", "#fff1ea", "#b23f0e"],
  ["Halden Labs opened INV-0146", "Just now", "#e2f3f1", "#0e6a63"],
  ["Payment recorded · $3,493.75", "Reminders stopped", "#e3f2e8", "#12713f"],
];
function AReminders() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Ground>
      <Glow x="80%" y="20%" size={1600} opacity={0.3} />
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 220 }}>
        <Rise text="Polite reminders, sent for you." start={2} size={92} />
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 720, display: "grid", gap: 24 }}>
        {REM.map(([t, s, tint, dot], i) => {
          const p = spring({ frame: f - 16 - i * 22, fps, config: { damping: 15 } });
          return <Notice key={i} title={t} sub={s} tint={tint} dot={dot} style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px) scale(${0.95 + p * 0.05})`, padding: "28px 32px" }} />;
        })}
      </div>
    </Ground>
  );
}
function APaid() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = spring({ frame: f - 30, fps, config: { damping: 11, stiffness: 180 } });
  return (
    <Ground>
      <Glow x="50%" y="100%" size={1700} opacity={0.3} />
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 200 }}>
        <Rise text="And stops the moment you're paid." start={2} size={88} />
      </div>
      <div style={{ position: "absolute", left: "50%", top: 640, transform: "translateX(-50%)" }}>
        <div style={{ position: "relative" }}>
          <Paper width={760} style={{ filter: "drop-shadow(0 50px 90px rgba(0,0,0,.6))" }} />
          <div style={{ position: "absolute", left: 120, top: 330, padding: "4px 26px", border: "12px solid #12713f", borderRadius: 18, color: "#12713f", fontWeight: 600, fontSize: 120, letterSpacing: "0.12em", background: "rgba(255,255,255,.85)", transform: `rotate(-11deg) scale(${2 - st})`, opacity: Math.min(1, st * 1.3) }}>PAID</div>
        </div>
      </div>
    </Ground>
  );
}

/* ---------- B. Your invoice could look like this ---------- */
function BCycle() {
  const f = useCurrentFrame();
  const idx = Math.min(TEMPLATES.length - 1, Math.floor(f / 13));
  const t = TEMPLATES[idx];
  const pop = ease(f % 13, 0, 6);
  return (
    <Ground>
      <Glow x="50%" y="30%" size={1700} opacity={0.3} />
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 180 }}>
        <Rise text="Your invoice could look like this." start={0} size={92} stagger={2} />
      </div>
      <div style={{ position: "absolute", left: "50%", top: 560, transform: `translateX(-50%) scale(${0.97 + pop * 0.03})`, opacity: 0.6 + pop * 0.4 }}>
        <Paper width={820} template={t.value} brand={BRANDS[idx % BRANDS.length]} style={{ filter: "drop-shadow(0 50px 90px rgba(0,0,0,.6))" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, textAlign: "center", fontFamily: mono, fontSize: 40, color: C.muted }}>{t.label} · {idx + 1} of 9</div>
    </Ground>
  );
}
function BColours() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = BRANDS[Math.min(BRANDS.length - 1, Math.floor(f / 18))];
  return (
    <Ground>
      <Glow x="50%" y="90%" size={1700} opacity={0.3} />
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 200 }}>
        <Rise text="Nine designs. Your colours. One click." start={2} size={92} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, display: "flex", justifyContent: "center", gap: 0 }}>
        {(["editorial", "stacked", "swiss"] as const).map((tpl, i) => {
          const s = spring({ frame: f - i * 6, fps, config: { damping: 16 } });
          return (
            <div key={tpl} style={{ margin: "0 -40px", transform: `translateY(${(1 - s) * 200 + (i === 1 ? 0 : 60)}px) rotate(${(i - 1) * 7}deg)`, zIndex: i === 1 ? 2 : 1, opacity: s }}>
              <Paper width={440} template={tpl} brand={brand} style={{ filter: "drop-shadow(0 40px 70px rgba(0,0,0,.6))" }} />
            </div>
          );
        })}
      </div>
    </Ground>
  );
}

/* ---------- C. Know the second they open it ---------- */
function COpened() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = spring({ frame: f - 14, fps, config: { damping: 14 } });
  return (
    <Ground>
      <Footage src="hands-typing-vertical.mp4" dim={0.5} push={0.08} />
      <AbsoluteFill style={{ padding: `0 ${PAD}px`, justifyContent: "center" }}>
        <Rise text="Know the second your client opens your invoice." start={0} size={110} stagger={2} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 200, opacity: n, transform: `translateY(${(1 - n) * -60}px)` }}>
        <Notice title="Northstar opened INV-0145" sub="Just now" tint="#e2f3f1" dot="#0e6a63" style={{ padding: "28px 32px" }} />
      </div>
    </Ground>
  );
}
function CStory() {
  const f = useCurrentFrame();
  const step = f < 40 ? "sent" : f < 80 ? "viewed" : "paid";
  return (
    <Ground>
      <Glow x="80%" y="15%" size={1600} opacity={0.3} />
      <div style={{ position: "absolute", left: PAD, top: 200, display: "grid", gap: 0 }}>
        {(["Sent.", "Opened.", "Paid."] as const).map((w, i) => {
          const p = ease(f, i * 40, i * 40 + 14);
          return <div key={w} style={{ fontSize: 170, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1.02, color: w === "Paid." ? C.tang : C.ink, opacity: 0.12 + p * 0.88 }}>{w}</div>;
        })}
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 860, background: "#fff", borderRadius: 28, overflow: "hidden", color: "#1a1916", boxShadow: "0 60px 120px -40px rgba(0,0,0,.8)" }}>
        <div style={{ height: 96, display: "flex", alignItems: "center", padding: "0 32px" }}>
          <span style={{ fontFamily: mono, fontSize: 30, color: "#5f5d58" }}>INV-0145</span>
          <span style={{ marginLeft: "auto" }}><Pill s={step} /></span>
        </div>
        <div style={{ padding: "0 32px 32px" }}><Paper width={836} /></div>
      </div>
    </Ground>
  );
}

/* ---------- the three cuts ---------- */
type Part = [() => ReactNode, number];
function Cut({ parts, cues }: { parts: Part[]; cues: Cue[] }) {
  let at = 0;
  const total = parts.reduce((s, [, d]) => s + d, 0);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {parts.map(([P, d], i) => {
        const from = at;
        at += d;
        return <Sequence key={i} from={from} durationInFrames={d}><P /></Sequence>;
      })}
      <SoundLayer cues={cues} fps={30} total={total} music="social" musicVolume={0.5} duck={0.2} />
    </AbsoluteFill>
  );
}
const sumTo = (parts: Part[], i: number) => parts.slice(0, i).reduce((s, [, d]) => s + d, 0);

const A_PARTS: Part[] = [[() => <BigHook text="Stop chasing" accent="invoices." footage="night-typing-vertical.mp4" />, 60], [AReminders, 180], [APaid, 120], [VEnd, 120]];
const B_PARTS: Part[] = [[BCycle, 120], [BColours, 120], [VEnd, 120]];
const C_PARTS: Part[] = [[COpened, 100], [CStory, 150], [VEnd, 120]];
export const V_FRAMES = { A: sumTo(A_PARTS, 4), B: sumTo(B_PARTS, 3), C: sumTo(C_PARTS, 3) };

export const VerticalA = () => (
  <Cut parts={A_PARTS} cues={[
    { kind: "vo", id: "v_a_hook", at: 2 },
    { kind: "vo", id: "v_a_body", at: sumTo(A_PARTS, 1) + 10 },
    ...[16, 38, 60, 82].map((o) => ({ kind: "sfx" as const, id: "pop", at: sumTo(A_PARTS, 1) + o, volume: 0.45 })),
    { kind: "sfx", id: "stamp", at: sumTo(A_PARTS, 2) + 28, volume: 0.7 },
    { kind: "vo", id: "v_end", at: sumTo(A_PARTS, 3) + 10 },
  ]} />
);
export const VerticalB = () => (
  <Cut parts={B_PARTS} cues={[
    { kind: "vo", id: "v_b_hook", at: 2 },
    ...Array.from({ length: 9 }, (_, k) => ({ kind: "sfx" as const, id: "slide", at: k * 13, volume: 0.25 })),
    { kind: "vo", id: "v_b_body", at: sumTo(B_PARTS, 1) + 8 },
    { kind: "vo", id: "v_end", at: sumTo(B_PARTS, 2) + 10 },
  ]} />
);
export const VerticalC = () => (
  <Cut parts={C_PARTS} cues={[
    { kind: "vo", id: "v_c_hook", at: 2 },
    { kind: "sfx", id: "chime", at: 14, volume: 0.4 },
    { kind: "vo", id: "v_c_body", at: sumTo(C_PARTS, 1) + 4 },
    { kind: "sfx", id: "stamp", at: sumTo(C_PARTS, 1) + 80, volume: 0.6 },
    { kind: "vo", id: "v_end", at: sumTo(C_PARTS, 2) + 10 },
  ]} />
);
