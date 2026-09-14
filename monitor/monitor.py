#!/usr/bin/env python3
"""Scarcinality monitor: collect, match, draft, queue. Never post.

    python3 monitor.py            one pass, writes queue/queue.json
    python3 monitor.py --refresh  rebuild the corpus index first
    python3 monitor.py --dry      collect and match, do not draft

Review what it finds by opening review.html in a browser.
"""
import os, sys, json, time, hashlib, argparse
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import corpus, sources, match, draft, review

QDIR = os.path.join(HERE, 'queue')
QFILE = os.path.join(QDIR, 'queue.json')
SEEN = os.path.join(QDIR, 'seen.json')


def cfg():
    return json.load(open(os.path.join(HERE, 'config.json')))


def key(item):
    return hashlib.sha1((item.get('url') or item.get('title', '')).encode()).hexdigest()[:16]


def collect(c, log):
    items = []
    for w in c['watchlist']:
        got, err = sources.google_news(w['query'], when='%dd' % c['window_days'])
        log.append(('news: ' + w['name'], len(got), err))
        items += got
    for t in c.get('federal_register_terms', []):
        got, err = sources.federal_register(t, days=c['window_days'])
        log.append(('fedreg: ' + t, len(got), err))
        items += got
    for f in c.get('feeds', []):
        got, err = sources.rss(f['url'], f['label'])
        log.append(('feed: ' + f['label'], len(got), err))
        items += got
    al = c.get('ad_library', {})
    if al.get('enabled'):
        for t in al.get('search_terms', []):
            got, err = sources.ad_library(t, page_ids=al.get('page_ids'),
                                          days=c['window_days'])
            log.append(('ads: ' + t, len(got), err))
            items += got
    # de-duplicate by url
    seen, uniq = set(), []
    for i in items:
        k = key(i)
        if k not in seen:
            seen.add(k); uniq.append(i)
    return uniq


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--refresh', action='store_true', help='rebuild the corpus index')
    ap.add_argument('--dry', action='store_true', help='match only, no drafting')
    a = ap.parse_args()

    os.makedirs(QDIR, exist_ok=True)
    c = cfg()

    if a.refresh or not os.path.exists(os.path.join(HERE, 'corpus.json')):
        docs, _ = corpus.save()
        print('corpus rebuilt: %d documents' % len(docs))
    docs = match.load_corpus()

    log = []
    items = collect(c, log)
    print('\nsources')
    for name, n, err in log:
        print('  %-38s %3d %s' % (name[:38], n, ('  ! ' + err[:70]) if err else ''))
    print('\n%d unique items in the last %d days' % (len(items), c['window_days']))

    old = json.load(open(SEEN)) if os.path.exists(SEEN) else {}
    cutoff = time.time() - 30 * 86400
    old = {k: v for k, v in old.items() if v > cutoff}

    ranked = []
    for it in items:
        if key(it) in old:
            continue
        ms = match.score(it, docs, min_score=c['min_score'])
        if ms:
            ranked.append((ms[0]['score'], it, ms))
    ranked.sort(key=lambda r: -r[0])
    print('%d matched above the bar (%d already seen)' % (len(ranked), len(old)))

    out = []
    for s, it, ms in ranked[:c['max_drafts_per_run']]:
        pack = match.evidence(it, ms)
        row = dict(id=key(it), score=s, collected=datetime.now(timezone.utc).isoformat(),
                   **pack)
        if not a.dry:
            row.update(draft.make(pack))
        out.append(row)
        old[key(it)] = time.time()

    json.dump(old, open(SEEN, 'w'))
    payload = dict(generated=datetime.now(timezone.utc).isoformat(),
                   window_days=c['window_days'], sources=[
                       dict(name=n, count=k, error=e) for n, k, e in log],
                   drafts=out)
    json.dump(payload, open(QFILE, 'w'), indent=1)
    review.build(payload)

    print('\n%d drafts written to %s' % (len(out), os.path.relpath(QFILE, HERE)))
    if out:
        print('\ntop of the queue')
        for r in out[:5]:
            m = r['matches'][0] if r['matches'] else {}
            print('  %.3f  %-58s -> %s' % (r['score'], r['item']['title'][:58],
                                           m.get('slug', '?')))
    print('\nReview: open %s' % os.path.join(HERE, 'review.html'))


if __name__ == '__main__':
    main()
