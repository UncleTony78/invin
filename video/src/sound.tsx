import { useEffect, useState } from "react";
import { Audio } from "@remotion/media";
import { Sequence, continueRender, delayRender, getStaticFiles, interpolate, staticFile } from "remotion";

/*
  The sound layer. Files come from scripts/audio.mjs (ElevenLabs) into public/audio; a cue whose file
  is not there yet is simply skipped, so the video renders silent until the audio exists.
*/
export type Cue = { kind: "vo" | "sfx" | "music"; id: string; at: number; volume?: number; trimEnd?: number };
type Manifest = { vo: Record<string, { seconds: number }>; sfx: Record<string, { seconds: number }>; music: Record<string, { seconds: number; loop?: boolean }> };

const exists = (p: string) => getStaticFiles().some((f) => f.name === p);

export function useManifest() {
  const [m, setM] = useState<Manifest | null>(null);
  const [handle] = useState(() => (exists("audio/manifest.json") ? delayRender("audio manifest") : null));
  useEffect(() => {
    if (handle === null) return;
    fetch(staticFile("audio/manifest.json")).then((r) => r.json()).then((j) => { setM(j); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
  return m;
}

/* Music ducks under the voice: 1 when clear, `duck` while a voice line plays, with short ramps */
export function SoundLayer({ cues, fps, total, music, musicVolume = 0.42, duck = 0.16 }: { cues: Cue[]; fps: number; total: number; music?: string; musicVolume?: number; duck?: number }) {
  const m = useManifest();
  const voWindows = cues.filter((c) => c.kind === "vo" && m?.vo[c.id]).map((c) => [c.at, c.at + Math.ceil((m!.vo[c.id].seconds + 0.2) * fps)] as const);
  const musicVol = (f: number) => {
    let v = musicVolume;
    for (const [a, b] of voWindows) {
      const k = interpolate(f, [a - 8, a, b, b + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      v = Math.min(v, musicVolume - (musicVolume - duck) * k);
    }
    // fade in and out
    return v * interpolate(f, [0, 20, total - 30, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  return (
    <>
      {music && exists(`audio/music/${music}.mp3`) && <Audio src={staticFile(`audio/music/${music}.mp3`)} volume={musicVol} loop={Boolean(m?.music[music]?.loop)} />}
      {cues.map((c, i) => {
        const p = `audio/${c.kind}/${c.id}.mp3`;
        if (c.kind === "music" || !exists(p)) return null;
        return (
          <Sequence key={i} from={c.at} name={`${c.kind}:${c.id}`}>
            <Audio src={staticFile(p)} volume={c.volume ?? (c.kind === "vo" ? 1 : 0.5)} />
          </Sequence>
        );
      })}
    </>
  );
}
