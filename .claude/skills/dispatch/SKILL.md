---
name: dispatch
description: Write and publish a Scarcinality dispatch or curiosity end to end, from research through live verification. Use this whenever the user asks to write, draft, extend or publish a dispatch, a curiosity, or a piece for scarcinality.com, including when they name one from the queue on the dispatches page, say "write the X dispatch", ask to update the CCI or the phase plane, or ask for a voice or accuracy pass on something already published. Also use it when adding a figure, an OG card or a listing entry to that site, because each of those is a step in this pipeline and skipping the others is how pages ship half finished.
---

# Publishing a Scarcinality dispatch

This site has one asset: it is believed. Every figure is sourced, the voice is
consistent, and when a reading turns out wrong it says so in public. That is
fragile and easy to erode one shortcut at a time, which is what this skill
exists to prevent.

Work in `/Users/josephpeffer/scarcinality-site`. The site deploys from GitHub
to Railway on push, and `server.js` serves `./public` only.

## The order that matters

Research, then write, then check, then publish. The expensive mistakes all
come from doing these out of order: writing before the numbers are confirmed,
or publishing before the check runs.

### 1. Establish the facts first, and verify the premise

**Never build on a premise you have not checked**, including one the user
states. This has already paid for itself twice: the Fed piece was framed
around a hike the user described, which turned out to be real; the Hormuz
reading was nearly revised in the wrong direction because the first search
returned three-month-old EIA releases describing a reopening that had since
reversed.

So: search for the current state, then search again for whether it still
holds. Prefer issuing agencies over coverage.

- Treasury Fiscal Data API, BLS, BEA, Fed (federalreserve.gov), EIA, Census.
- **FRED is unreachable from this environment.** Go to the issuer instead.
- `curl` to `api.fiscaldata.treasury.gov` is blocked by the sandbox; use
  WebFetch against the same URL, which works.

When figures from different sources disagree, resolve it before writing. The
disagreement is often the story: customs receipts appeared to fall because
the published series is net of refunds, and that discrepancy became the lead.

If the user's premise is wrong, say so plainly and early rather than writing
around it.

### 2. Write

Read `references/voice.md` before drafting. The short version: short
sentences, concrete before abstract, no em dashes, US spelling, and earn the
abstraction rather than opening with it.

Copy the structure of an existing dispatch rather than inventing one.
`public/dispatch-long-end-votes.html` is a good current template: head block,
`post-head` with `post-meta` / `h1` / `dek` / share button, a `stamp`
paragraph stating the claims and the caveat, then `article class="prose"`.

Structural pieces available: `.pull` for a turn in the argument, `.statgrid`
for four figures, `table.ledger` for a comparison, `.formula` for an
arithmetic block, `figure.fig` for a chart.

**Include a falsification section.** Every dispatch ends by saying what would
prove it wrong, in public, in checkable terms. This is the site's signature
and the reason its readings carry weight. A prediction that only counts the
quarters it wins is not a prediction.

**Steelman the other side** in a short section before that. If the piece
argues against a policy, say when that policy would be right.

### 3. Draw the figure

Hand-write the SVG. No chart library. `viewBox="0 0 720 330"` is the usual
frame; give every drawn shape an explicit fill, put `role="img"` and a real
`aria-label` on the `<svg>`, and write a `figcaption` that names the source.

Compute the geometry explicitly rather than eyeballing it: pick the value
range, derive pixels per unit, and place bars and gridlines from that. Labels
have collided more than once, so check the actual text coordinates against
the shapes rather than trusting the render.

Then look at it. `scripts/render_figure.py` extracts the figure and renders it
to PNG with headless Chrome so you can see it:

```bash
python3 .claude/skills/dispatch/scripts/render_figure.py public/dispatch-foo.html
```

Read the PNG. Chart bugs are visual and the measurements will not catch a
label sitting on top of a bar.

### 4. Check before publishing

```bash
python3 .claude/skills/dispatch/scripts/check.py public/dispatch-foo.html
```

This is the step that gets skipped when things feel finished, and it is the
step that catches the things that embarrass the site. It verifies the voice
metrics, em dashes, US spelling, tag balance, internal links, the social
metadata, the figure's accessibility attributes, the listing entry, the OG
card, and whether any quoted index figure still matches `data/cci.json`.

Fix failures. Warnings are judgment calls, except the voice one: if it flags,
break the sentences it lists. The check prints them.

### 5. Publish

```bash
# listing entry on public/dispatches.html, newest first, matching the markup
# of the surrounding <article class="entry"> blocks

python3 scripts/make-og-images.py dispatch-foo dispatches   # cards
python3 .claude/skills/dispatch/scripts/check.py public/dispatch-foo.html
git add ... && git commit && git push origin main
```

If the push 403s, the `gh` active account has flipped. Fix with
`gh auth switch --user gvhc4j69nd-glitch` and push again. Never force-push,
never `--no-verify`.

Then confirm it actually deployed rather than assuming:

```bash
until curl -s https://www.scarcinality.com/dispatch-foo | grep -q "Some Phrase"; do sleep 5; done
```

## Retire it from the queue

If the dispatch answers an item under a `q-head` heading on
`public/dispatches.html`, remove that item and add the title to the "Retired
from this list because it was delivered" note. The queue is a promise; leaving
delivered items on it makes the rest look like filler.

## Updating the CCI

The index is the site's most valuable asset and its most dangerous, because a
number published with a methodology can be checked. Read
`references/cci.md` before touching `public/data/cci.json`.

The thing most easily missed: changing the data makes every dispatch quoting
the old reading stale. `check.py --all` catches that. Dated dispatches keep
their original figures because they carry an "as of" line and were correct
when published, but the gauge dispatch itself has a "Where it points today"
section that must be current.

## Things that have actually gone wrong here

Worth knowing so they do not repeat:

- **A scripted multi-edit aborted partway** and shipped a half-rewritten page.
  When applying several regex edits, write the file after each successful one
  so a later mismatch cannot discard earlier work.
- **Screenshots of the browser pane come back blank** and
  `document.documentElement.clientWidth` reads 0, producing false overflow
  readings. Headless Chrome against `localhost:3000` is reliable; the pane is
  not. Measure at a real viewport before believing an overflow report.
- **A wrapper element set to `inline-flex`** shrank a button to the width of
  its longest word across 41 pages. Verify rendered dimensions, not just that
  an element exists in the DOM.
- **An SVG `og:image`** renders as nothing on Facebook and LinkedIn. Cards
  must be PNG, which `scripts/make-og-images.py` handles.

## Reference files

- `references/voice.md` — the house voice, with the measured targets and
  worked before-and-after examples.
- `references/cci.md` — the index: methodology, how to rescore a quarter, and
  the standard for writing a revision note.
