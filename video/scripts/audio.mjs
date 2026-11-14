/*
  Generates the launch video's voiceover, sound effects and music with ElevenLabs.
  Reads ELEVENLABS_API_KEY (and optional ELEVEN_VOICE_ID) from video/.env, never from the command line.
  Writes public/audio/<kind>/<id>.mp3 and public/audio/manifest.json (each file's length in seconds).
  Skips files that already exist, so re-running only fills gaps. Pass --force to regenerate.

    node scripts/audio.mjs voices      list the voices on your account
    node scripts/audio.mjs             generate everything missing
    node scripts/audio.mjs vo|sfx|music  generate one kind
*/
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const env = Object.fromEntries(
  (fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "")
    .split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const KEY = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error("No ELEVENLABS_API_KEY. Put it in video/.env (see video/.env.example)."); process.exit(1); }

const API = "https://api.elevenlabs.io/v1";
const plan = JSON.parse(fs.readFileSync(path.join(root, "src/audio-plan.json"), "utf8"));
const out = path.join(root, "public/audio");
const manifestPath = path.join(out, "manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { vo: {}, sfx: {}, music: {} };
const force = process.argv.includes("--force");
const only = process.argv.slice(2).find((a) => ["vo", "sfx", "music", "voices"].includes(a));

async function call(p, body, json = false) {
  const r = await fetch(API + p, { method: body ? "POST" : "GET", headers: { "xi-api-key": KEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return json ? r.json() : Buffer.from(await r.arrayBuffer());
}
const save = (kind, id, buf) => { fs.mkdirSync(path.join(out, kind), { recursive: true }); fs.writeFileSync(path.join(out, kind, `${id}.mp3`), buf); };
const has = (kind, id) => !force && fs.existsSync(path.join(out, kind, `${id}.mp3`)) && manifest[kind]?.[id];
const writeManifest = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

if (only === "voices") {
  const { voices } = await call("/voices", null, true);
  for (const v of voices) console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${Object.values(v.labels ?? {}).join(", ")}`);
  process.exit(0);
}

let voice = env.ELEVEN_VOICE_ID;
if ((!only || only === "vo") && !voice) {
  const { voices } = await call("/voices", null, true);
  const pick = voices.find((v) => /narrat|documentary|calm|warm/i.test(Object.values(v.labels ?? {}).join(" "))) ?? voices[0];
  voice = pick.voice_id;
  console.log(`Voice: ${pick.name} (set ELEVEN_VOICE_ID in .env to choose another; "node scripts/audio.mjs voices" lists them)`);
}

if (!only || only === "vo") {
  for (const line of plan.vo) {
    if (has("vo", line.id)) continue;
    const r = await call(`/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, { text: line.text, model_id: "eleven_multilingual_v2", voice_settings: plan.voiceSettings }, true);
    save("vo", line.id, Buffer.from(r.audio_base64, "base64"));
    const ends = r.alignment?.character_end_times_seconds ?? [];
    manifest.vo[line.id] = { seconds: +(ends[ends.length - 1] ?? 2).toFixed(2), text: line.text };
    writeManifest();
    console.log(`vo ${line.id}: ${manifest.vo[line.id].seconds}s`);
  }
}
if (!only || only === "sfx") {
  for (const s of plan.sfx) {
    if (has("sfx", s.id)) continue;
    save("sfx", s.id, await call("/sound-generation?output_format=mp3_44100_128", { text: s.text, duration_seconds: s.seconds, prompt_influence: 0.5 }));
    manifest.sfx[s.id] = { seconds: s.seconds };
    writeManifest();
    console.log(`sfx ${s.id}`);
  }
}
if (!only || only === "music") {
  for (const m of plan.music) {
    if (has("music", m.id)) continue;
    save("music", m.id, await call("/music", { prompt: m.prompt, music_length_ms: m.seconds * 1000, force_instrumental: true }));
    manifest.music[m.id] = { seconds: m.seconds };
    writeManifest();
    console.log(`music ${m.id}`);
  }
}
console.log("Done:", manifestPath);
