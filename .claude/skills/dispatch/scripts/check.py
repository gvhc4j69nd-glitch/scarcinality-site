#!/usr/bin/env python3
"""Pre-flight check for a Scarcinality dispatch.

Catches the things that have actually gone wrong on this site: prose drifting
long, figures quoted from a stale index, unbalanced tags after a scripted
edit, links to pages that do not exist, and missing social metadata.

    python3 check.py public/dispatch-foo.html          one page
    python3 check.py --all                             every dispatch
    python3 check.py public/dispatch-foo.html --strict exit 1 on any warning

Exit code is 0 when clean, 1 when something failed. Warnings alone do not
fail unless --strict, because a couple of them are judgment calls.
"""
import re, os, sys, json, glob, html, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
# skill lives at <repo>/.claude/skills/dispatch/scripts/check.py
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PUB = os.path.join(REPO, 'public')

# The strongest pieces on the site cluster here. The corpus median is looser
# (12.1 / 37.5 / 5.6) because older pieces drifted; aim at the good ones.
TARGET = dict(avg=12.0, short=38.0, long=4.0)
BEST = '11.0 w/sent, 45% short, 2% long'

# Widened after 'behaviour', 'specialised' and 'millimetre' each survived an
# earlier normalization pass and were only caught by running this across all
# dispatches at once.
BRITISH = r'\b(centre|centres|labour|colour|colours|programme|defence|favourable|' \
          r'organisation|organise[dsr]?|realise[dsr]?|analyse[dsr]?|behaviour|' \
          r'neighbourhood|artefact|specialise[dsr]?|recognise[dsr]?|utilise[dsr]?|' \
          r'minimise[dsr]?|maximise[dsr]?|normalise[dsr]?|categorise[dsr]?|' \
          r'millimetre|centimetre|kilometre|metre|litre|tonne|sceptic|sceptical|' \
          r'practise|licence|enquiry|whilst|amongst)\b'

RESET = '\033[0m' if sys.stdout.isatty() else ''
def c(code, s):
    return ('\033[%sm%s\033[0m' % (code, s)) if sys.stdout.isatty() else s
OK, BAD, WARN = lambda s: c('32', s), lambda s: c('31', s), lambda s: c('33', s)


class Report:
    def __init__(self, path):
        self.path = path
        self.fails, self.warns, self.notes = [], [], []

    def fail(self, m): self.fails.append(m)
    def warn(self, m): self.warns.append(m)
    def note(self, m): self.notes.append(m)

    def show(self):
        print('\n%s' % c('1', os.path.basename(self.path)))
        for m in self.notes:
            print('   %s %s' % (OK('ok  '), m))
        for m in self.warns:
            print('   %s %s' % (WARN('warn'), m))
        for m in self.fails:
            print('   %s %s' % (BAD('FAIL'), m))
        if not self.fails and not self.warns:
            print('   %s clean' % OK('ok  '))
        return not self.fails


def prose_of(t):
    """The body text a reader actually reads: no figures, no tables, no
    stat grids. Those contain unpunctuated labels that run together and
    inflate the sentence-length numbers if left in."""
    m = re.search(r'<article class="prose">(.*?)</article>', t, re.S)
    if not m:
        return None
    b = m.group(1)
    b = re.sub(r'<svg.*?</svg>|<table.*?</table>|<figcaption.*?</figcaption>', '', b, flags=re.S)
    # .formula and .ledger-wrap hold label/value rows with no terminal
    # punctuation; left in, they read as one enormous sentence.
    for cls in ('statgrid', 'formula', 'ledger-wrap'):
        b = re.sub(r'<div class="%s".*?</div>\s*(?=<)' % cls, '', b, flags=re.S)
    b = re.sub(r'<h2[^>]*>.*?</h2>', ' . ', b, flags=re.S)   # headings end a sentence
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', b))).strip()


def voice(r, t):
    x = prose_of(t)
    if not x:
        r.warn('no <article class="prose"> block, skipping voice check')
        return
    s = [y for y in re.split(r'(?<=[.!?])\s+', x) if len(y.split()) > 1]
    if len(s) < 10:
        r.warn('too little prose to measure')
        return
    w = [len(y.split()) for y in s]
    avg = sum(w) / len(s)
    sh = 100 * sum(1 for k in w if k <= 8) / len(s)
    lo = 100 * sum(1 for k in w if k >= 25) / len(s)
    line = '%.1f w/sent, %.0f%% short, %.0f%% long  (target <=%.0f / >=%.0f%% / <=%.0f%%)' % (
        avg, sh, lo, TARGET['avg'], TARGET['short'], TARGET['long'])
    bad = avg > TARGET['avg'] or sh < TARGET['short'] or lo > TARGET['long']
    (r.warn if bad else r.note)('voice: ' + line)
    if bad:
        longs = sorted(((len(y.split()), y) for y in s if len(y.split()) >= 25), reverse=True)
        for n, y in longs[:5]:
            r.warn('  %2dw  %s' % (n, y[:110]))
        r.warn('  the strongest pieces run %s' % BEST)


def house(r, t):
    if '—' in t:
        r.fail('em dash present (%d). The site does not use them.' % t.count('—'))
    b = set(m.group(0).lower() for m in re.finditer(BRITISH, t, re.I))
    if b:
        r.fail('British spelling: %s' % ', '.join(sorted(b)))
    if re.search(r'[‘’“”]', t) is None and "'" in prose_of(t or '') or '':
        pass  # curly quotes are fine either way; not worth failing on
    if '!' in re.sub(r'<[^>]+>', '', t).replace('!important', ''):
        x = prose_of(t)
        if x and '!' in x:
            r.warn('exclamation mark in prose')


def structure(r, t):
    for e in ('p', 'div', 'table', 'tr', 'td', 'figure', 'article', 'svg', 'h2', 'main'):
        o, cl = len(re.findall('<%s[ >]' % e, t)), t.count('</%s>' % e)
        if o != cl:
            r.fail('<%s> unbalanced: %d open, %d close' % (e, o, cl))
    for tag, pat in (('canonical', r'<link rel="canonical" href="([^"]+)"'),
                     ('og:image', r'<meta property="og:image" content="([^"]+)"'),
                     ('og:url', r'<meta property="og:url" content="([^"]+)"'),
                     ('twitter:card', r'<meta name="twitter:card" content="summary_large_image"'),
                     ('description', r'<meta name="description" content="([^"]+)"')):
        if not re.search(pat, t):
            r.fail('missing %s' % tag)
    if '/assets/actions.js' not in t:
        r.fail('missing actions.js (share and like controls)')
    if '/assets/cci-badge.js' not in t:
        r.fail('missing cci-badge.js (header index reading)')
    if 'class="share-btn"' not in t:
        r.warn('no standfirst share button')
    if re.search(r'og:image" content="[^"]*\.svg"', t):
        r.fail('og:image is an SVG. Social platforms will not render it. '
               'Run scripts/make-og-images.py for this slug.')


def links(r, t, slug):
    for l in sorted(set(re.findall(r'href="(/[a-z0-9\-]+)"', t))):
        if not os.path.exists(os.path.join(PUB, l.lstrip('/') + '.html')):
            r.fail('link to a page that does not exist: %s' % l)
    og = os.path.join(PUB, 'assets', 'og', slug + '.png')
    if not os.path.exists(og):
        r.fail('no OG card at assets/og/%s.png' % slug)
    d = os.path.join(PUB, 'dispatches.html')
    if os.path.exists(d) and slug.startswith('dispatch-'):
        if '/%s"' % slug not in open(d, encoding='utf-8').read():
            r.fail('not listed in dispatches.html')


def figures(r, t):
    svgs = re.findall(r'<svg[^>]*viewBox="([^"]*)"', t)
    if not svgs:
        r.note('no inline figure')
        return
    for vb in svgs:
        if len(vb.split()) != 4:
            r.fail('svg viewBox malformed: %r' % vb)
    # Only the figures matter here. The footer's Facebook mark is decorative
    # and correctly carries aria-hidden instead.
    for fm in re.finditer(r'<figure class="fig">\s*(<svg[^>]*>)', t):
        tag = fm.group(1)
        if 'role="img"' not in tag:
            r.warn('a figure svg has no role="img"')
        elif 'aria-label' not in tag:
            r.warn('a figure svg has role="img" but no aria-label')


def cci(r, t):
    """Any dispatch quoting the index must agree with the published series.
    This is the check that was nearly missed when the Q3 reading was revised."""
    p = os.path.join(PUB, 'data', 'cci.json')
    if not os.path.exists(p) or 'minus 1' not in t and 'CCI' not in t and 'gauge' not in t.lower():
        return
    d = json.load(open(p))
    live = [q for q in d['quarters'] if not q.get('projected')][-1]
    cur = abs(live['cci'])
    quoted = set()
    for m in re.finditer(r'(?:minus |&minus;|-)(\d\.\d\d)', t):
        quoted.add(float(m.group(1)))
    stale = {q for q in quoted if abs(q - cur) > 0.001 and 0.3 < q < 5}
    if stale and cur not in quoted:
        r.warn('quotes index-shaped figures %s but the live reading is %.2f (%s). '
               'Check none of these is a stale CCI.'
               % (sorted(stale), live['cci'], live['q']))
    elif cur in quoted:
        r.note('CCI figure matches the published series (%.2f, %s)' % (live['cci'], live['q']))


def check(path):
    r = Report(path)
    t = open(path, encoding='utf-8').read()
    slug = os.path.basename(path)[:-5]
    voice(r, t); house(r, t); structure(r, t); links(r, t, slug); figures(r, t); cci(r, t)
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='*')
    ap.add_argument('--all', action='store_true', help='every dispatch in public/')
    ap.add_argument('--strict', action='store_true', help='warnings fail too')
    a = ap.parse_args()

    paths = a.paths or []
    if a.all:
        paths = sorted(glob.glob(os.path.join(PUB, 'dispatch-*.html')))
    if not paths:
        ap.error('give a path or --all')

    ok = True
    reports = []
    for p in paths:
        if not os.path.isabs(p):
            p = os.path.join(REPO, p) if os.path.exists(os.path.join(REPO, p)) else p
        if not os.path.exists(p):
            print(BAD('missing: %s' % p)); ok = False; continue
        rep = check(p)
        reports.append(rep)
        if not rep.show():
            ok = False
        if a.strict and rep.warns:
            ok = False

    if len(reports) > 1:
        f = sum(len(r.fails) for r in reports)
        w = sum(len(r.warns) for r in reports)
        print('\n%s  %d pages, %d failures, %d warnings' % (c('1', 'summary'), len(reports), f, w))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
