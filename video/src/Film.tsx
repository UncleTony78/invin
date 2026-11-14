import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { Hook, PayBroll, TeamFigures } from "./broll";
import { Automation, Build, Designs, End, Headline, Lifecycle, Logo } from "./scenes";
import { SoundLayer, type Cue } from "./sound";
import { C } from "./theme";

/* The 16:9 launch film: hook, product, b-roll beats, end card. Script: SCRIPT.md */
const T = 14;
type Scene = { id: string; C: () => ReactNode; d: number; via?: "fade" | "slide" };
const SCENES: Scene[] = [
  { id: "hook", C: Hook, d: 160 },
  { id: "logo", C: Logo, d: 80 },
  { id: "headline", C: Headline, d: 130 },
  { id: "build", C: Build, d: 200, via: "slide" },
  { id: "life", C: Lifecycle, d: 190 },
  { id: "pay", C: PayBroll, d: 90 },
  { id: "designs", C: Designs, d: 190, via: "slide" },
  { id: "auto", C: Automation, d: 190 },
  { id: "team", C: TeamFigures, d: 160 },
  { id: "end", C: End, d: 170 },
];
const START: Record<string, number> = {};
SCENES.reduce((at, s) => { START[s.id] = at; return at + s.d - T; }, 0);
export const FILM_FRAMES = SCENES.reduce((s, x) => s + x.d, 0) - T * (SCENES.length - 1);

const at = (scene: string, off: number) => START[scene] + off;
const CUES: Cue[] = [
  { kind: "sfx", id: "room", at: 0, volume: 0.35 },
  { kind: "vo", id: "hook", at: at("hook", 10) },
  { kind: "sfx", id: "chime", at: at("hook", 40), volume: 0.3 },
  ...SCENES.slice(1).map((s) => ({ kind: "sfx" as const, id: "whoosh", at: START[s.id] - 4, volume: 0.28 })),
  { kind: "sfx", id: "thock", at: at("logo", 24), volume: 0.5 },
  { kind: "vo", id: "meet", at: at("logo", 30) },
  { kind: "vo", id: "headline", at: at("headline", 8) },
  { kind: "vo", id: "build", at: at("build", 10) },
  ...[40, 70, 100].map((o) => ({ kind: "sfx" as const, id: "tick", at: at("build", o), volume: 0.4 })),
  { kind: "vo", id: "life", at: at("life", 12) },
  { kind: "sfx", id: "send", at: at("life", 36), volume: 0.4 },
  { kind: "sfx", id: "chime", at: at("life", 72), volume: 0.35 },
  { kind: "sfx", id: "stamp", at: at("life", 110), volume: 0.7 },
  { kind: "sfx", id: "pop", at: at("pay", 22), volume: 0.45 },
  { kind: "vo", id: "designs", at: at("designs", 8) },
  ...[10, 15, 20, 25, 30].map((o) => ({ kind: "sfx" as const, id: "slide", at: at("designs", o), volume: 0.22 })),
  { kind: "vo", id: "auto", at: at("auto", 8) },
  ...[14, 30, 46, 62, 78].map((o) => ({ kind: "sfx" as const, id: "pop", at: at("auto", o), volume: 0.4 })),
  { kind: "vo", id: "figures", at: at("team", 6) },
  { kind: "vo", id: "end", at: at("end", 14) },
  { kind: "sfx", id: "click", at: at("end", 54), volume: 0.5 },
];

export function Film() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <TransitionSeries>
        {SCENES.flatMap((s, i) => {
          const seq = (
            <TransitionSeries.Sequence key={s.id} durationInFrames={s.d} name={s.id}>
              <s.C />
            </TransitionSeries.Sequence>
          );
          const next = SCENES[i + 1];
          if (!next) return [seq];
          const pres = next.via === "slide" ? slide({ direction: "from-right" }) : fade();
          return [seq, <TransitionSeries.Transition key={`t${i}`} presentation={pres} timing={linearTiming({ durationInFrames: T })} />];
        })}
      </TransitionSeries>
      <SoundLayer cues={CUES} fps={30} total={FILM_FRAMES} music="film" />
    </AbsoluteFill>
  );
}
