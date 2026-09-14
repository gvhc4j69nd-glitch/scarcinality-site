"""Build a searchable index of the published dispatches and curiosities.

Reads public/*.html directly, so the index is never out of date with the
site. No dependencies: this has to run from a cron job on a laptop.

Each entry carries the title, url, the standfirst, the figures the piece
actually establishes, and a bag of weighted terms used for matching.
"""
import re, os, json, glob, math, html, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
BASE = 'https://www.scarcinality.com'

# Words that carry no topical signal. Deliberately short: the framework's own
# vocabulary (scarcity, money, credit) must stay, because it is what we match on.
STOP = set("""a an the and or but if then than that this these those of in on at to for from by with
as is are was were be been being it its it's he she they them their there here what which who whom
whose when where why how all any both each few more most other some such no nor not only own same so
too very can will just should now about into over under again further once do does did doing have has
had having i you your we our us me my his her him would could may might must shall one two three also
because while during before after above below up down out off between against among per cs said says
say new news like get got make made take taken see seen go going come came know known think thought
way ways thing things time times year years day days first last next many much lot lots even still yet
nbsp rsquo lsquo ldquo rdquo middot minus amp rarr larr mdash ndash quot hellip
""".split())

FIG = re.compile(r'\$?\d[\d,]*\.?\d*\s?(?:percent|%|billion|million|trillion|basis points|bps|'
                 r'hours|sheets|inches|acres|MW|barrels|x)?', re.I)


def words(s):
    return [w for w in re.findall(r"[a-z][a-z'-]{2,}", s.lower()) if w not in STOP]


def read(path):
    t = open(path, encoding='utf-8').read()

    def one(pat, g=1, default=''):
        m = re.search(pat, t, re.S)
        return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.group(g))).strip()) if m else default

    title = one(r'<h1[^>]*>(.*?)</h1>')
    if not title:
        title = re.split(r'&middot;|·', one(r'<title>(.*?)</title>'))[0].strip()
    dek = one(r'<p class="dek">(.*?)</p>') or one(r'<meta name="description" content="([^"]*)"')

    m = re.search(r'<article class="prose">(.*?)</article>', t, re.S)
    body = m.group(1) if m else t
    body = re.sub(r'<svg.*?</svg>|<style.*?</style>|<script.*?</script>', '', body, flags=re.S)
    plain = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body)))

    # headings carry disproportionate topical weight
    heads = ' '.join(re.sub(r'<[^>]+>', '', h) for h in re.findall(r'<h2[^>]*>(.*?)</h2>', body, re.S))

    # The numbers the piece stands behind, taken as whole sentences. Fragments
    # cut out of the middle of a clause read as mangled and, worse, can change
    # what the figure claims. A comment has to quote something accurate.
    NUM = re.compile(r'\$?\d[\d,]*\.?\d*\s?(?:percent|billion|million|trillion|basis points|'
                     r'hours|sheets|inches|acres|MW|barrels|times|x)\b', re.I)
    figs, seen = [], set()
    for sent in re.split(r'(?<=[.!?])\s+', plain):
        s = re.sub(r'\s+', ' ', sent).strip()
        if not (25 < len(s) < 190) or not NUM.search(s):
            continue
        if s[0].islower() or s.count(',') > 5:
            continue
        k = re.sub(r'[^a-z0-9]', '', s.lower())[:45]
        if k in seen:
            continue
        seen.add(k); figs.append(s)

    pull = one(r'class="pull"[^>]*>(.*?)</(?:p|div)>')

    return dict(
        slug=os.path.basename(path)[:-5],
        url='%s/%s' % (BASE, os.path.basename(path)[:-5]),
        title=title, dek=dek, pull=pull,
        figures=figs[:14],
        terms=collections.Counter(words(title) * 4 + words(heads) * 3 +
                                  words(dek) * 2 + words(plain)),
    )


def build(verbose=False):
    skip = {'_cover', '404', 'index', 'dispatches', 'curiosities', 'glossary'}
    docs = []
    for p in sorted(glob.glob(os.path.join(PUB, '*.html'))):
        slug = os.path.basename(p)[:-5]
        if slug in skip:
            continue
        d = read(p)
        if d['title'] and sum(d['terms'].values()) > 120:
            docs.append(d)

    # idf across the corpus, so shared framework words do not dominate
    df = collections.Counter()
    for d in docs:
        for w in d['terms']:
            df[w] += 1
    n = len(docs)
    for d in docs:
        tot = sum(d['terms'].values())
        d['weights'] = {w: (c / tot) * math.log(1 + n / (1 + df[w]))
                        for w, c in d['terms'].items() if c > 1}
        d.pop('terms')
        if verbose:
            top = sorted(d['weights'].items(), key=lambda kv: -kv[1])[:8]
            print('  %-42s %s' % (d['slug'], ', '.join(w for w, _ in top)))
    return docs


def save(path=None):
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus.json')
    docs = build()
    json.dump(docs, open(path, 'w'), indent=1)
    return docs, path


if __name__ == '__main__':
    docs = build(verbose=True)
    _, p = save()
    print('\n%d documents indexed -> %s' % (len(docs), p))
