# Scarcinality monitor

Watches public sources for posts a Scarcinality piece has something to add to,
matches them against the published corpus, and writes a draft comment to a
review queue.

**It never posts anything.** Every draft waits for you to read it, edit it, and
post it yourself.

## Why it works this way

The original idea was to watch candidates' Facebook Pages and auto-comment.
That is not buildable, for three separate reasons:

1. Reading Pages you do not own needs **Page Public Content Access**, gated
   behind Meta App Review plus Business Verification and granted case by case.
2. The Graph API's comment endpoints operate on Pages you manage. There is no
   supported way to comment as your Page on someone else's Page's post.
3. Browser automation could do it, violates Facebook's terms, and is exactly
   the pattern Meta's inauthentic-behavior systems look for. The likely cost is
   the Scarcinality Page.

Beyond the mechanics: automated comments on strangers' political posts read as
spam no matter how good the content is, and Scarcinality's whole asset is being
careful and cited. So this keeps the collection and the drafting, and keeps a
human on the judgment.

## Running it

```bash
cd monitor
python3 monitor.py --refresh     # first run: build the corpus index too
open review.html
```

No dependencies. Python 3 standard library only.

| Flag | Effect |
|---|---|
| `--refresh` | Rebuild the corpus index from `public/*.html` first. Run after publishing. |
| `--dry` | Collect and match, skip drafting. |

Weekly, via `crontab -e`:

```
0 8 * * 1 cd /Users/josephpeffer/scarcinality-site/monitor && /usr/bin/python3 monitor.py --refresh
```

## Sources

| Source | Auth | Status |
|---|---|---|
| Google News RSS | none | working |
| Federal Register API | none | working |
| Congressional committee RSS | none | working |
| Meta Ad Library | token | needs setup, see below |

### Turning on the Ad Library

This is the one genuinely good Facebook source: political and issue ads with
full creative text, which is where candidates say what they actually want to
push. It is open by design, but it needs a token.

1. Confirm identity and location at **facebook.com/ID**. This is the same
   process required to run ads about social issues, elections or politics, and
   takes a few days.
2. Create a Meta developer app, then a system user token with the
   `ads_archive` scope. System user tokens are the right kind for a scheduled
   job because they do not expire the way user tokens do.
3. `export FB_ADS_TOKEN=...`
4. Set `ad_library.enabled` to `true` in `config.json`.

You have to do step 1 yourself. Until then the source reports why it is idle
and everything else runs normally.

## Better drafts

Without a key, a draft is a scaffold: the matched piece's figure, a gap for the
connecting sentence, and the link. Deliberately unfinished, because a scaffold
that reads like a finished comment invites posting it unedited.

With a key it writes a real draft in the house voice:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export SCARC_MODEL=claude-sonnet-5     # optional, this is the default
```

The model is told to quote exactly one figure from the evidence, never invent a
number, and reply `SKIP` when the post and the piece are not really about the
same thing. Skipped items still appear, with the reason.

## Tuning

**`config.json`** is the control panel.

- `watchlist` — the news queries. Phrase them the way coverage would be
  written, not the way you would title a dispatch.
- `feeds` — any RSS. Candidate press-release feeds belong here.
- `min_score` — currently `0.45`. Lower it to see more and worse.
- `window_days`, `max_drafts_per_run` — self-explanatory.

**`topics.json`** does the precision work and is the file worth maintaining.

News feeds return about 80 characters of summary, which is far too little for
statistical matching to be reliable. So phrases route explicitly: a post
containing "dividend check" goes to *The Check and the Ceiling* regardless of
what the statistics think. Add phrases when you publish.

Matching runs both ways and takes the better score. `rule` in the review badge
means a phrase fired; `stat` means vocabulary overlap alone, which is weaker and
worth reading more skeptically.

## Files

```
corpus.py     index public/*.html: title, figures, weighted terms
sources.py    the four collectors
match.py      phrase rules + statistical scoring, evidence assembly
draft.py      scaffold, or Claude if a key is present
review.py     writes the self-contained review page
monitor.py    orchestrator
config.json   watchlist, feeds, thresholds
topics.json   phrase routing
queue/        generated: queue.json, seen.json
```

`corpus.json`, `queue/` and `review.html` are generated and gitignored.
`seen.json` stops the same item being drafted twice and forgets after 30 days.

## One caveat worth keeping in view

Comments on other people's posts are a weak distribution channel. This tool
makes them cheap, not effective. The site's real constraint is that almost
nobody has read it yet, and the book proposal is the higher-leverage answer to
that.
