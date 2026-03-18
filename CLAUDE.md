# rexaffects-site

Personal portfolio site for Rex Roberts - visual artist, VJ instructor, and tool builder.

## Tech Stack
- Static HTML/CSS/JS (no build process)
- Hosted on GitHub Pages with custom domain (rexaffects.com)
- CNAME file for domain mapping
- .nojekyll to disable Jekyll processing

## Debugging Log

### 2026-03-17: GitHub Pages Deployment Failures

**Symptoms:**
- Site stuck showing old content ("TESL8" instead of "Tessellate")
- All GitHub Pages deployments failing since March 13
- Error: "No url found for submodule path 'rexaffects-site' in .gitmodules"

**Root Cause:**
A folder called `rexaffects-site` was accidentally committed as a git submodule (mode 160000) without a corresponding `.gitmodules` file. GitHub Pages tried to clone this non-existent submodule on every build and failed.

**How to Diagnose:**
1. Check GitHub Actions tab for failed "pages build and deployment" workflows
2. Look for submodule-related errors in build logs
3. Run `git ls-files --stage | findstr "160000"` to find submodule entries
4. Check if `.gitmodules` exists and has URLs for all submodules

**Fix:**
```bash
git rm --cached rexaffects-site
git commit -m "Remove broken submodule reference"
git push
```

**Lesson Learned:**
If GitHub Pages deployments suddenly start failing with git/submodule errors, check for orphaned submodule entries in the git index that don't have corresponding `.gitmodules` definitions.

---

### 2026-03-18: Site Refresh & Content Updates

**Session Summary:**
Major content updates after fixing deployment issues.

**Hero Carousel (3 rotating images):**
- Slide 1: `images/Yer dead Suwannee Tipper Speaker.png` — Stage projection at Suwannee/Tipper
- Slide 2: `images/Eros.png` — 3D artwork (yin-yang figures with glowing ring)
- Slide 3: `images/Installation/The Medium Rex Maria Cornelio.jpg` — Tessellate installation team photo

**CSS Fix for Hero Images:**
- Removed `background` shorthand from `.hero-slide:nth-child()` rules that was overriding `background-position: center` and `background-size: cover`
- Changed to `background-image` only for gradient fallbacks
- Portrait images work with default centering; can add `background-position: center top` inline if needed to focus on specific area

**Learn Section:**
- Added plugin showcase video (YouTube: qUst5rcKzFU) — 13-min showcase of all 7 Resolume plugins
- Replaced placeholder in slot 1 (was "Installation & Projection Mapping" coming soon)
- Updated subtitle: "from beginner to deep dive" → "from beginner to advanced"
- Video titles updated:
  - Slot 1: "Plugin Showcase"
  - Slot 2: "Resolume Tutorials" (plural)
  - Slot 3: "Community Favorite" (was Blob Tracking V2 — Plugin Drop)
  - Slot 4: "Inside My VJ Workflow" (was Deep Dive)

**Featured Project (Tessellate):**
- Added team photo: `images/Installation/The gang Tessellate.jpg`
- Shows image with hover overlay: "Full Build Breakdown — Coming Soon"
- New CSS classes: `.video-placeholder-image` and `.video-overlay`

**Copy Updates:**

*I Build section:*
> From large-scale installations to Resolume plugins to 3D art — I follow what excites me by building tools I wish existed and creating art I want to see in the world.

*Behind the Scenes section:*
> I believe we're all vessels with an impactful creative capacity. The only real choice is: do we consume or create? This is why I teach — so more people can figure out what they're called to create, find a medium that fits for them, and start building.

*About section (Rex Roberts bio):*
> My work spans digital art, projection mapping, and live performance. Lately I've been pulling it all together — designing projection-mapped sculptures and bringing them to life with integrated lighting.

**Files Added to Repo:**
- `images/Yer dead Suwannee Tipper Speaker.png`
- `images/Eros.png`
- `images/Installation/The gang Tessellate.jpg`
- `images/Installation/The Medium Rex Maria Cornelio.jpg`

**Notes for Future:**
- Hero slot 2: tried Brady Backwoods (portrait, cropped poorly), then VJ booth imagejpeg_0(12).jpg, settled on Eros 3D artwork
- Tessellate video placeholder ready to swap for YouTube embed when video is complete
- "I Teach" section left unchanged — current copy works well
