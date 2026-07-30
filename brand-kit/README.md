# Lyrical brand kit

Share this whole folder with partners, contractors and new employees. Start with
**`brand-guide.html`**: open it in any browser, no internet needed.

## Contents

| Path | What it is |
|---|---|
| `brand-guide.html` | The guide. Mark, colour, type, voice, motion. Read this first. |
| `logo/svg/` | Vector logos. The mark-only files are pure paths and work anywhere. |
| `logo/png/` | Transparent PNGs at 1024, 512 and 192px. |
| `social/` | Platform-sized images for Instagram and LinkedIn, plus a link-preview card. |
| `social-profiles.md` | Bios, handles, and which file goes in which field. |
| `colour/` | Hex and RGB values, a swatch sheet, a type specimen. |
| `fonts/` | The two web fonts, and where to get the desktop versions. |
| `templates/` | Email signature and enquiry reply templates. |
| `marketing-checklist.md` | What still needs setting up, in priority order. |

## The three rules people break

1. **Nothing goes inside the mark.** It has no enclosed area, so anything placed in the
   middle sits on top of the strokes and vanishes.
2. **Ember never carries body text.** 3.2:1 on cream. Fills and large type only.
3. **No gradients, anywhere.**

## This folder is generated

Everything except this README is produced from the same geometry and colour tokens the
website uses. Do not edit these files by hand. Change the code and re-run:

```
npx tsx scripts/build-brand-kit.mjs
```

That way the kit and the live site can never quietly disagree.
