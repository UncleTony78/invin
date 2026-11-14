# InVin launch video (Remotion)

A 16:9 launch film and three 9:16 social cuts, built from InVin's real invoice renderer
(`../web/src/components/invoice/paper.tsx`). Script, hooks and sound plan: [SCRIPT.md](SCRIPT.md).

| Composition | Size | Length |
|---|---|---|
| `Launch` | 1920×1080 | about 47 s |
| `V-A-StopChasing` | 1080×1920 | 16 s |
| `V-B-Designs` | 1080×1920 | 12 s |
| `V-C-Opened` | 1080×1920 | 12 s |

## 1. Voice, music and sound effects (ElevenLabs)

1. Sign in at elevenlabs.io, open **Developers** (or your profile) → **API Keys**
   (https://elevenlabs.io/app/settings/api-keys) and create a key. Give it access to Text to Speech,
   Sound Effects, Music and Voices (read).
2. Paste it into `video/.env` as `ELEVENLABS_API_KEY=...` (the file is git-ignored; never commit or share it).
3. Optional: `node scripts/audio.mjs voices` lists your voices; put the one you like in `ELEVEN_VOICE_ID`.
4. `node scripts/audio.mjs` generates everything into `public/audio` and writes `manifest.json`.
   Re-running only fills gaps; `--force` regenerates. Lines, prompts and settings: `src/audio-plan.json`.

Commercial use of the voice and the music needs a paid ElevenLabs plan (Starter or above). The whole
set costs roughly 2,000 credits of voice, 2,000 of effects and 1,000 of music.

The video picks the audio up automatically: every cue whose file exists plays, the music ducks under the
voice. Without audio it renders silent.

## 2. B-roll

Six clips from Pexels (Pexels License: free for commercial use, no attribution required), kept out of git.
Download them into `public/broll`:

| File | Pexels |
|---|---|
| `late-laptop.mp4` | https://www.pexels.com/video/35331901/ |
| `stressed-laptop.mp4` | https://www.pexels.com/video/8486622/ (2048×1080 file) |
| `phone-card.mp4` | https://www.pexels.com/video/7534330/ |
| `studio-team.mp4` | https://www.pexels.com/video/5475311/ |
| `night-typing-vertical.mp4` | https://www.pexels.com/video/34771072/ |
| `hands-typing-vertical.mp4` | https://www.pexels.com/video/10374892/ |

## 3. Preview and render

```bash
npm install
npm run studio                     # edit and preview in the browser
npx remotion render src/index.ts Launch out/invin-launch.mp4
npx remotion render src/index.ts V-A-StopChasing out/invin-stop-chasing.mp4
npx remotion render src/index.ts V-B-Designs out/invin-designs.mp4
npx remotion render src/index.ts V-C-Opened out/invin-opened.mp4
```
