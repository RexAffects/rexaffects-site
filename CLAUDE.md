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
