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
