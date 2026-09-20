#!/usr/bin/env python3
"""Render a dispatch's inline figures to PNG so they can actually be looked at.

Chart bugs are visual. Labels collide, a bar overshoots its gridline, a value
sits on top of an axis. None of that shows up in a measurement, and the
browser pane returns blank captures often enough not to rely on it, so this
goes straight to headless Chrome.

    python3 render_figure.py public/dispatch-foo.html
    python3 render_figure.py public/dispatch-foo.html --index 1
    python3 render_figure.py public/dispatch-foo.html --out /tmp/fig.png

Prints the path of each PNG written. Read them.
"""
import re, os, sys, html, tempfile, subprocess, argparse, shutil

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FONTS = ('https://fonts.googleapis.com/css2?'
         'family=EB+Garamond:ital,wght@0,400;0,600;1,400&'
         'family=IBM+Plex+Mono:wght@400;500;600&display=swap')

SHELL = """<meta charset="utf-8">
<link rel="stylesheet" href="%s">
<body style="margin:0;background:#f6f2e9">
<div style="width:%dpx;padding:16px">%s</div>"""


def figures(path):
    t = open(path, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'<figure class="fig">\s*(<svg.*?</svg>)', t, re.S):
        out.append(m.group(1))
    if not out:
        # A real figure not wrapped in <figure class="fig">. Skip anything
        # marked aria-hidden: those are decorative marks like the footer's
        # Facebook icon, not charts.
        for m in re.finditer(r'(<svg[^>]*viewBox=.*?</svg>)', t, re.S):
            head = m.group(1)[:m.group(1).find('>') + 1]
            if 'aria-hidden' in head:
                continue
            out.append(m.group(1))
    return out


def render(svg, out, width=760):
    vb = re.search(r'viewBox="([\d.\s-]+)"', svg)
    w, h = (720.0, 330.0)
    if vb:
        p = vb.group(1).split()
        if len(p) == 4:
            w, h = float(p[2]), float(p[3])
    inner = width - 32
    height = int(inner * (h / w)) + 40
    d = tempfile.mkdtemp()
    try:
        f = os.path.join(d, 'f.html')
        open(f, 'w', encoding='utf-8').write(SHELL % (FONTS, inner, svg))
        subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                        '--screenshot=' + out, '--window-size=%d,%d' % (width, height),
                        '--virtual-time-budget=5000', f],
                       capture_output=True, timeout=90)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return os.path.exists(out) and os.path.getsize(out) > 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path')
    ap.add_argument('--index', type=int, help='render only this figure (0 based)')
    ap.add_argument('--out', help='output path for a single figure')
    ap.add_argument('--width', type=int, default=760)
    a = ap.parse_args()

    if not os.path.exists(CHROME):
        sys.exit('Google Chrome not found at %s' % CHROME)
    if not os.path.exists(a.path):
        sys.exit('no such file: %s' % a.path)

    figs = figures(a.path)
    if not figs:
        sys.exit('no inline figure found in %s' % os.path.basename(a.path))

    slug = os.path.basename(a.path).rsplit('.', 1)[0]
    idx = [a.index] if a.index is not None else range(len(figs))
    for i in idx:
        if i >= len(figs):
            sys.exit('only %d figure(s) in this page' % len(figs))
        out = a.out if (a.out and len(list(idx)) == 1) else \
            os.path.join(tempfile.gettempdir(), '%s-fig%d.png' % (slug, i))
        if render(figs[i], out, a.width):
            print(out)
        else:
            print('failed to render figure %d' % i, file=sys.stderr)


if __name__ == '__main__':
    main()
