# /listen audio

Three files, all MP3, all the same song:

| Put here | What it is |
|---|---|
| `original.mp3` | The record as released, in English |
| `artist-spanish.mp3` | The artist's own authorised Spanish release |
| `lyrical-spanish.mp3` | Our version |

Then set `hasAudio: true` for that track in `content/listen.ts`. Until you do, the page
says "not loaded yet" rather than showing a player that fails when pressed.

Trim all three to the SAME section of the song. The comparison only works if a listener
can hear the same moment three times, and it is the fastest way to make the difference
obvious. Stereo, and loud enough to match each other: a quieter version sounds worse
regardless of how good it is.

This folder is gitignored except for this file. Audio is not committed to the repository:
it is a public repo, and these are recordings we do not hold a licence to distribute.

## Where these files actually live

Not in git, and that has a consequence worth knowing.

`npx vercel --prod` uploads the working directory and, tested on 2026-08-04, uploads these
files even though `.gitignore` excludes them. So production has the audio while the
repository does not.

That means the ONLY copies are this folder and the current deployment. A fresh clone on
another machine has `hasAudio: true` in `content/listen.ts` and no files to match it, so
deploying from there would publish players that fail when pressed. If that ever happens,
either copy the audio across first or set the flags back to false.

Keep the source FLACs somewhere backed up. They are not in here either.

## What was done to the source

96 kHz / 24-bit FLAC, about 73 MB each, converted to 320 kbps MP3 at 44.1 kHz, about 7.8 MB
each. 96 kHz is pointless over the web and no browser plays FLAC reliably enough to depend on.

Loudness was measured and left alone: -13.0 LUFS against -12.7 LUFS, a 0.3 LU difference,
which is inaudible. Had they differed by more, the louder one would sound better regardless
of quality and the comparison would have been rigged. Measure again if either file changes.
