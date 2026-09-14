"""Score an incoming item against the published corpus, and assemble the
evidence a comment would need.

The bar is deliberately high. A weak match produces a generic comment, and a
generic comment on a stranger's post is spam whoever wrote it. Better to
surface four good candidates a week than forty mediocre ones.
"""
import re, math, json, os, collections
from corpus import words

HERE = os.path.dirname(os.path.abspath(__file__))


_RULES = None


def rules():
    global _RULES
    if _RULES is None:
        p = os.path.join(HERE, 'topics.json')
        _RULES = json.load(open(p))['rules'] if os.path.exists(p) else []
    return _RULES


def rule_hits(item):
    """Phrase routing. News feeds return roughly 80 characters of summary, which
    is too little for statistical matching to be reliable, so explicit phrases
    do the precision work and the statistics fill in around them."""
    hay = ('%s %s' % (item.get('title', ''), item.get('summary', ''))).lower()
    out = {}
    for r in rules():
        fired = [p for p in r.get('any', []) if p in hay]
        if not fired:
            continue
        if any(p in hay for p in r.get('not', [])):
            continue
        if not all(p in hay for p in r.get('all', [])):
            continue
        # a longer phrase is a stronger signal than a single common word
        conf = min(0.95, 0.42 + 0.06 * len(fired) + 0.012 * max(len(p) for p in fired))
        if conf > out.get(r['slug'], 0):
            out[r['slug']] = (conf, fired)
    return {k: v for k, v in out.items()}


def score(item, docs, min_score=0.055, min_hits=3):
    """Return matches above the bar, best first."""
    text = '%s %s %s' % (item.get('title', ''), item.get('summary', ''), item.get('query', ''))
    tw = collections.Counter(words(text))
    if not tw:
        return []
    ntok = sum(tw.values())
    out = []
    for d in docs:
        w = d.get('weights') or {}
        hits = [(t, c, w[t]) for t, c in tw.items() if t in w]
        if len(hits) < min_hits:
            continue
        # weighted overlap, normalised by item length so long items do not win
        s = sum(math.sqrt(c) * wt for _, c, wt in hits) / math.sqrt(ntok)
        if s < min_score:
            continue
        top = sorted(hits, key=lambda h: -h[2] * math.sqrt(h[1]))[:6]
        out.append(dict(slug=d['slug'], title=d['title'], url=d['url'],
                        dek=d['dek'], pull=d.get('pull', ''),
                        figures=d.get('figures', []),
                        score=round(s, 4), overlap=[t for t, _, _ in top],
                        via='stat'))

    # fold in phrase routing, which outranks a weak statistical match
    by_slug = {m['slug']: m for m in out}
    lookup = {d['slug']: d for d in docs}
    for slug, (conf, fired) in rule_hits(item).items():
        d = lookup.get(slug)
        if not d:
            continue
        m = by_slug.get(slug)
        if m:
            m['score'] = round(max(m['score'], conf), 4)
            m['via'] = 'rule+stat'
            m['phrases'] = fired
        else:
            out.append(dict(slug=slug, title=d['title'], url=d['url'], dek=d['dek'],
                            pull=d.get('pull', ''), figures=d.get('figures', []),
                            score=round(conf, 4), overlap=[], via='rule', phrases=fired))

    out = [m for m in out if m['score'] >= min_score]
    out.sort(key=lambda m: -m['score'])
    return out


def pick_figures(match, item, n=3):
    """Choose the figures from the matched piece that share vocabulary with
    the incoming item, so the comment cites something actually relevant."""
    it = set(words('%s %s' % (item.get('title', ''), item.get('summary', ''))))
    scored = []
    for f in match['figures']:
        fw = set(words(f))
        scored.append((len(fw & it), -len(f), f))
    scored.sort(reverse=True)
    return [f for hit, _, f in scored[:n] if hit > 0] or match['figures'][:1]


def evidence(item, matches, n=2):
    """The pack a human or a model needs to write the comment."""
    top = matches[:n]
    return dict(
        item=dict(title=item.get('title'), summary=item.get('summary'),
                  url=item.get('url'), source=item.get('source'),
                  author=item.get('author'), published=item.get('published'),
                  query=item.get('query')),
        matches=[dict(title=m['title'], url=m['url'], slug=m['slug'],
                      score=m['score'], overlap=m['overlap'],
                      via=m.get('via', 'stat'), phrases=m.get('phrases', []),
                      figures=pick_figures(m, item),
                      pull=m['pull'][:240]) for m in top],
    )


def load_corpus(path=None):
    path = path or os.path.join(HERE, 'corpus.json')
    if not os.path.exists(path):
        import corpus
        corpus.save(path)
    return json.load(open(path))
