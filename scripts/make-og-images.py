#!/usr/bin/env python3
"""Build a per-page Open Graph image for every page on the site.

Why this exists: social platforms do not render SVG in link previews, and the
site's og:image tags all pointed at SVG files, 40 of them at the same generic
phase plane. So a shared dispatch showed either nothing or someone else's
chart. This renders a real 1200x630 PNG per page, using that page's own
figure where it has one and its pull quote where it does not.

Usage:  python3 scripts/make-og-images.py [slug ...]
        no arguments rebuilds everything

Requires Google Chrome for headless rendering. Cards are written to
public/assets/og/<slug>.png and the og:image / twitter:image tags in each
page are rewritten to point at them.
"""
import re, os, sys, glob, html, subprocess, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
OUT = os.path.join(PUB, 'assets', 'og')
BASE = 'https://www.scarcinality.com'
CHROME = ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
W, H = 1200, 630

SKIP = {'_cover.html', '404.html'}


def txt(s):
    """Tag-strip and collapse, keeping HTML entities intact for re-embedding."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip()


def grab(t):
    """Pull title, kicker and artwork out of one page."""
    m = re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S)
    title = txt(m.group(1)) if m else ''
    if not title:
        # the full-viewport map pages carry their name in <title> only
        m = re.search(r'<title>(.*?)</title>', t, re.S)
        if m:
            title = re.split(r'&middot;|·', txt(m.group(1)))[0].strip()

    m = re.search(r'<p class="post-meta">(.*?)</p>', t, re.S)
    kicker = txt(m.group(1)) if m else ''
    if not kicker:
        m = re.search(r'<p class="sub-meta"[^>]*>(.*?)</p>', t, re.S)
        kicker = txt(m.group(1)) if m else 'Scarcinality'
    # post-meta separators are written both as the entity and as the glyph
    kicker = re.split(r'&middot;|·', kicker)[0].strip() or 'Scarcinality'

    # artwork: first inline figure svg, else a figure's img, else a bare svg
    art = None
    m = re.search(r'<figure class="fig">\s*(<svg.*?</svg>)', t, re.S)
    if m:
        art = m.group(1)
    else:
        m = re.search(r'<figure class="fig">\s*<img src="([^"]+)"', t)
        if not m:
            m = re.search(r'<meta property="og:image" content="[^"]*/(curiosity-[^"/]+\.svg)"', t)
            if m:
                m = re.match(r'(.*)', '/assets/' + m.group(1))
        if m:
            src = m.group(1)
            p = os.path.join(PUB, src.lstrip('/'))
            if os.path.exists(p):
                art = open(p, encoding='utf-8').read()
                art = re.sub(r'<\?xml[^>]*\?>', '', art)

    pull = ''
    m = re.search(r'class="pull"[^>]*>(.*?)</(?:p|div)>', t, re.S)
    if m:
        pull = txt(m.group(1))
    if not pull:
        m = re.search(r'<p class="dek">(.*?)</p>', t, re.S)
        pull = txt(m.group(1)) if m else ''
    if not pull:
        # the core pages carry no pull or dek; their description is the
        # sentence that would have been one
        m = re.search(r'<meta name="description" content="([^"]*)"', t)
        pull = html.unescape(m.group(1)).strip() if m else ''

    return title, kicker, art, pull


CARD = """<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
 *{{box-sizing:border-box;margin:0;padding:0}}
 html,body{{width:{W}px;height:{H}px;overflow:hidden}}
 body{{background:#f6f2e9;font-family:"EB Garamond",Georgia,serif;color:#211d18;
   display:flex;flex-direction:column;padding:52px 60px 44px;position:relative}}
 .rule{{position:absolute;left:0;top:0;bottom:0;width:10px;background:#8a3324}}
 .kick{{font-family:"IBM Plex Mono",monospace;font-size:17px;letter-spacing:.22em;
   text-transform:uppercase;color:#8a8073;margin-bottom:18px}}
 h1{{font-size:{TS}px;line-height:1.03;font-weight:600;letter-spacing:-.015em;
   max-width:{TW}px}}
 .art{{flex:1;display:flex;align-items:center;justify-content:center;
   margin-top:26px;min-height:0}}
 .art svg{{max-width:100%;max-height:100%;height:auto;width:auto}}
 .quote{{flex:1;display:flex;align-items:center;margin-top:30px}}
 .quote p{{font-size:31px;line-height:1.34;font-style:italic;color:#4a4238;
   border-left:4px solid #8a3324;padding-left:26px;max-width:1000px;
   display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}}
 footer{{display:flex;justify-content:space-between;align-items:baseline;
   font-family:"IBM Plex Mono",monospace;font-size:17px;letter-spacing:.12em;
   text-transform:uppercase;color:#8a8073;border-top:1px solid #ddd3c2;padding-top:16px;
   margin-top:20px}}
 footer b{{color:#8a3324;font-weight:600}}
</style>
<div class="rule"></div>
<div class="kick">{KICK}</div>
<h1>{TITLE}</h1>
{BODY}
<footer><span>scarcinality.com</span><b>A theory of which shortage is real</b></footer>
"""


def build(slug, t):
    title, kicker, art, pull = grab(t)
    if not title:
        return None
    n = len(title)
    ts = 76 if n <= 26 else 64 if n <= 40 else 54 if n <= 58 else 46
    body = ('<div class="art">%s</div>' % art) if art else \
           ('<div class="quote"><p>%s</p></div>' % html.escape(pull))
    return CARD.format(W=W, H=H, TS=ts, TW=1040, KICK=html.escape(kicker),
                       TITLE=html.escape(title), BODY=body)


def render(card_html, png):
    d = tempfile.mkdtemp()
    try:
        f = os.path.join(d, 'card.html')
        open(f, 'w', encoding='utf-8').write(card_html)
        subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1',
                        '--screenshot=' + png, '--window-size=%d,%d' % (W, H),
                        '--virtual-time-budget=6000', f],
                       capture_output=True, timeout=90)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return os.path.exists(png) and os.path.getsize(png) > 2000


def retag(path, t, slug, title):
    """Point the social tags at the rendered card."""
    url = '%s/assets/og/%s.png' % (BASE, slug)
    alt = html.escape('%s. A Scarcinality card.' % title, quote=True)
    t = re.sub(r'<meta property="og:image" content="[^"]*"',
               '<meta property="og:image" content="%s"' % url, t)
    t = re.sub(r'<meta name="twitter:image" content="[^"]*"',
               '<meta name="twitter:image" content="%s"' % url, t)
    if 'og:image"' not in t:      # page had none at all
        t = t.replace('<meta property="og:type"',
                      '<meta property="og:image" content="%s">\n<meta property="og:type"' % url, 1)
    for tag, val in (('og:image:width', str(W)), ('og:image:height', str(H)),
                     ('og:image:type', 'image/png'), ('og:image:alt', alt)):
        if 'property="%s"' % tag not in t:
            t = t.replace('<meta property="og:image" content="%s">' % url,
                          '<meta property="og:image" content="%s">\n<meta property="%s" content="%s">'
                          % (url, tag, val), 1)
    if 'twitter:card' not in t:
        t = t.replace('<meta name="twitter:title"',
                      '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title"', 1)
    else:
        t = re.sub(r'<meta name="twitter:card" content="[^"]*"',
                   '<meta name="twitter:card" content="summary_large_image"', t)
    open(path, 'w', encoding='utf-8').write(t)


def main():
    os.makedirs(OUT, exist_ok=True)
    want = set(sys.argv[1:])
    ok = fail = 0
    for path in sorted(glob.glob(os.path.join(PUB, '*.html'))):
        f = os.path.basename(path)
        if f in SKIP:
            continue
        slug = f[:-5]
        if want and slug not in want:
            continue
        t = open(path, encoding='utf-8').read()
        card = build(slug, t)
        if card is None:
            print('  skip (no h1)   %s' % slug); continue
        png = os.path.join(OUT, slug + '.png')
        if render(card, png):
            title = grab(t)[0]
            retag(path, t, slug, title)
            kb = os.path.getsize(png) // 1024
            print('  %-46s %4d KB' % (slug, kb)); ok += 1
        else:
            print('  FAILED         %s' % slug); fail += 1
    print('\n%d built, %d failed' % (ok, fail))


if __name__ == '__main__':
    main()
