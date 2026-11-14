import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Ground, Rise, clamp, ease } from "./scenes";
import { C, mono } from "./theme";

/* Stock footage (Pexels License) under a slow push-in, graded towards InVin's warm dark */
export function Footage({ src, startFrom = 0, push = 0.06, dim = 0.45, style }: { src: string; startFrom?: number; push?: number; dim?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = 1 + interpolate(f, [0, durationInFrames], [0, push], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <OffthreadVideo src={staticFile(`broll/${src}`)} startFrom={startFrom} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s})` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(13,12,11,${dim * 0.6}) 0%, rgba(13,12,11,${dim}) 55%, rgba(13,12,11,${Math.min(0.92, dim + 0.35)}) 100%)` }} />
    </AbsoluteFill>
  );
}

/* A notification card, like the ones InVin sends */
export function Notice({ title, sub, dot = C.tang, tint = "#fff1ea", style }: { title: string; sub: string; dot?: string; tint?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", background: "#fff", color: "#1a1916", borderRadius: 22, padding: "22px 28px", boxShadow: "0 30px 60px -24px rgba(0,0,0,.8)", ...style }}>
      <span style={{ width: 52, height: 52, borderRadius: 14, background: tint, display: "grid", placeItems: "center", flex: "none" }}><span style={{ width: 16, height: 16, borderRadius: "50%", background: dot }} /></span>
      <span><b style={{ display: "block", fontWeight: 500, fontSize: 28 }}>{title}</b><span style={{ fontSize: 22, color: "#5f5d58" }}>{sub}</span></span>
    </div>
  );
}

/* 0. The hook: late at night, still unpaid */
export function Hook() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: f - 40, fps, config: { damping: 15 } });
  return (
    <Ground>
      <Footage src="late-laptop.mp4" dim={0.5} push={0.08} />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "flex-end", paddingBottom: 150 }}>
        <Rise text="You finished the work three weeks ago." start={6} size={84} />
        <Rise text="Still waiting to get paid." start={26} size={84} color={C.tang} />
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 160, top: 150, opacity: card, transform: `translateY(${(1 - card) * -30}px)` }}>
        <Notice title="INV-0139 · Halden Labs" sub="Sent 21 days ago · not paid" />
      </div>
      <div style={{ position: "absolute", left: 160, top: 150, fontFamily: mono, fontSize: 26, color: C.muted, opacity: ease(f, 10, 30) }}>11:48 PM</div>
    </Ground>
  );
}

/* The paying beat: a client pays from their phone */
export function PayBroll() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: f - 22, fps, config: { damping: 15 } });
  return (
    <Ground>
      <Footage src="phone-card.mp4" startFrom={30} dim={0.25} push={0.05} />
      <div style={{ position: "absolute", left: 160, bottom: 140, width: 680, opacity: card, transform: `translateY(${(1 - card) * 40}px) scale(${0.96 + card * 0.04})` }}>
        <Notice title="Northstar paid £2,250.00" sub="Bank transfer · receipt sent" dot={C.paid} tint={C.paidBg} />
      </div>
    </Ground>
  );
}

/* The team beat: the figures over a studio at work */
export function TeamFigures() {
  const f = useCurrentFrame();
  const figs: [number, string][] = [[9, "invoice designs"], [4, "currencies"], [5, "reminder steps"], [60, "seconds to undo a receipt"]];
  return (
    <Ground>
      <Footage src="studio-team.mp4" dim={0.62} push={0.05} />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center" }}>
        <Rise text="Your whole team. Your own email domain." start={4} size={72} />
        <div style={{ marginTop: 80, display: "flex", justifyContent: "space-between" }}>
          {figs.map(([n, l], i) => {
            const p = ease(f, 24 + i * 8, 58 + i * 8);
            return (
              <div key={l} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
                <div style={{ fontSize: 200, fontWeight: 500, letterSpacing: "-0.06em", lineHeight: 1, color: i === 0 ? C.tang : C.ink, fontVariantNumeric: "tabular-nums" }}>{Math.round(n * p)}</div>
                <div style={{ fontSize: 28, color: "#c9c5bd", marginTop: 10 }}>{l}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Ground>
  );
}
