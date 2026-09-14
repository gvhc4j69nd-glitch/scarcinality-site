"""Write a self-contained review page for the queue.

The data is inlined rather than fetched, so the file opens by double-click.
Reading a local JSON over file:// is blocked by the browser, and this tool
should not need a server to be useful.
"""
import os, json, html, datetime

HERE = os.path.dirname(os.path.abspath(__file__))

PAGE = """<!doctype html><meta charset="utf-8">
<title>Scarcinality monitor &middot; review queue</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{--bg:#f6f2e9;--paper:#fbf9f4;--ink:#211d18;--soft:#4a4238;--grey:#8a8073;
 --rule:#ddd3c2;--ox:#8a3324;--ok:#3f6b3a;--warn:#7a5a18}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:"EB Garamond",Georgia,serif;
 font-size:17px;line-height:1.55;margin:0;padding:0 1.2rem 5rem}
.wrap{max-width:54rem;margin:0 auto}
header{padding:2.6rem 0 1.2rem;border-bottom:1px solid var(--rule);margin-bottom:1.6rem}
h1{font-size:2rem;margin:0 0 .3rem;font-weight:600;letter-spacing:-.01em}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace}
.meta{font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.12em;
 text-transform:uppercase;color:var(--grey)}
.bar{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0 0}
.bar button{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.1em;
 text-transform:uppercase;padding:.35rem .7rem;border:1px solid var(--rule);
 background:none;color:var(--grey);cursor:pointer;border-radius:2px}
.bar button.on{color:var(--ox);border-color:var(--ox);background:#f2e4e0}
.card{background:var(--paper);border:1px solid var(--rule);border-left:3px solid var(--ox);
 padding:1.1rem 1.3rem;margin:0 0 1.2rem}
.card.done{opacity:.42;border-left-color:var(--ok)}
.card.hid{display:none}
.src{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.1em;
 text-transform:uppercase;color:var(--grey);display:flex;gap:.6rem;flex-wrap:wrap;
 align-items:center;margin-bottom:.45rem}
.badge{border:1px solid var(--rule);padding:.05rem .4rem;border-radius:2px}
.badge.rule{color:var(--ox);border-color:var(--ox)}
h2{font-size:1.2rem;margin:.1rem 0 .3rem;font-weight:600;line-height:1.25}
h2 a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--rule)}
h2 a:hover{color:var(--ox)}
.sum{color:var(--soft);font-size:.95rem;margin:0 0 .7rem}
.match{border-top:1px solid var(--rule);padding-top:.7rem;margin-top:.5rem}
.match .lab{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.11em;
 text-transform:uppercase;color:var(--grey)}
.match a{color:var(--ox);text-decoration:none;border-bottom:1px solid rgba(138,51,36,.3)}
ul.figs{margin:.45rem 0 .2rem;padding-left:1.1rem;font-size:.9rem;color:var(--soft)}
ul.figs li{margin-bottom:.18rem;cursor:pointer}
ul.figs li:hover{color:var(--ox)}
textarea{width:100%;min-height:9.5rem;font-family:"EB Garamond",Georgia,serif;font-size:1rem;
 line-height:1.5;padding:.7rem .8rem;border:1px solid var(--rule);background:var(--bg);
 color:var(--ink);border-radius:2px;resize:vertical;margin-top:.6rem}
textarea:focus{outline:2px solid var(--ox);outline-offset:1px}
.acts{display:flex;gap:.5rem;align-items:center;margin-top:.55rem;flex-wrap:wrap}
.acts button{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.1em;
 text-transform:uppercase;padding:.4rem .8rem;border:1px solid var(--rule);background:none;
 color:var(--soft);cursor:pointer;border-radius:2px}
.acts button.primary{border-color:var(--ox);color:var(--ox)}
.acts button.primary:hover{background:#f2e4e0}
.acts button:hover{border-color:var(--ox);color:var(--ox)}
.count{font-family:"IBM Plex Mono",monospace;font-size:.62rem;color:var(--grey);margin-left:auto}
.count.over{color:var(--ox)}
.note{font-family:"IBM Plex Mono",monospace;font-size:.6rem;color:var(--warn)}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--rule);
 font-family:"IBM Plex Mono",monospace;font-size:.62rem;color:var(--grey);line-height:1.7}
.empty{padding:3rem 0;text-align:center;color:var(--grey);font-style:italic}
</style>
<div class="wrap">
<header>
  <p class="meta">Scarcinality monitor</p>
  <h1>Review queue</h1>
  <p class="meta">Generated {GEN} &middot; {N} drafts &middot; {WIN} day window</p>
  <p style="font-size:.92rem;color:var(--soft);margin:.7rem 0 0">
    Nothing here has been posted. Edit a draft, copy it, and post it yourself if it earns the space.
    Read the source post first: a comment that does not add a number is not worth leaving.</p>
  <div class="bar">
    <button id="f-all" class="on" onclick="filt('all')">All</button>
    <button id="f-todo" onclick="filt('todo')">Unreviewed</button>
    <button id="f-done" onclick="filt('done')">Handled</button>
    <button onclick="reset()" style="margin-left:auto">Clear marks</button>
  </div>
</header>
{CARDS}
<footer>
  Sources this run: {SRC}<br>
  Drafts are suggestions. The figures come from published pieces; check them against the source before posting.
</footer>
</div>
<script>
var K='scarc-monitor-handled';
function get(){try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return {}}}
function set(o){try{localStorage.setItem(K,JSON.stringify(o))}catch(e){}}
function paint(){var h=get();
  document.querySelectorAll('.card').forEach(function(c){
    c.classList.toggle('done',!!h[c.dataset.id]);});
  filt(window.__f||'all');}
function mark(id,btn){var h=get();h[id]=h[id]?0:1;if(!h[id])delete h[id];set(h);paint();}
function filt(w){window.__f=w;var h=get();
  ['all','todo','done'].forEach(function(k){var b=document.getElementById('f-'+k);if(b)b.classList.toggle('on',k===w);});
  document.querySelectorAll('.card').forEach(function(c){
    var d=!!h[c.dataset.id];
    c.classList.toggle('hid', (w==='todo'&&d)||(w==='done'&&!d));});}
function reset(){set({});paint();}
function copy(id,btn){var t=document.getElementById('t-'+id);
  t.select();t.setSelectionRange(0,99999);
  navigator.clipboard.writeText(t.value).then(function(){
    var o=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=o},1400);});}
function ins(id,el){var t=document.getElementById('t-'+id);
  t.value=(t.value?t.value+' ':'')+el.textContent.trim();t.focus();words(id);}
function words(id){var t=document.getElementById('t-'+id);
  var n=(t.value.trim().match(/\\S+/g)||[]).length;
  var c=document.getElementById('c-'+id);c.textContent=n+' words';
  c.classList.toggle('over',n>75);}
document.querySelectorAll('textarea').forEach(function(t){
  words(t.id.slice(2));t.addEventListener('input',function(){words(t.id.slice(2))});});
paint();
</script>
"""

CARD = """<div class="card" data-id="{ID}">
  <div class="src">
    <span class="badge {VIACLS}">{VIA} {SCORE}</span>
    <span>{SOURCE}</span>{AUTHOR}
    <span>{WHEN}</span>
  </div>
  <h2><a href="{IURL}" target="_blank" rel="noopener">{ITITLE}</a></h2>
  <p class="sum">{ISUM}</p>
  <div class="match">
    <span class="lab">Matched piece{PHR}</span><br>
    <a href="{MURL}" target="_blank" rel="noopener">{MTITLE}</a>
    <ul class="figs">{FIGS}</ul>
    <textarea id="t-{ID}">{DRAFT}</textarea>
    <div class="acts">
      <button class="primary" onclick="copy('{ID}',this)">Copy</button>
      <button onclick="mark('{ID}',this)">Mark handled</button>
      {NOTE}
      <span class="count" id="c-{ID}"></span>
    </div>
  </div>
</div>"""


def esc(s):
    return html.escape(str(s or ''), quote=True)


def build(payload, out=None):
    out = out or os.path.join(HERE, 'review.html')
    cards = []
    for d in payload.get('drafts', []):
        m = (d.get('matches') or [{}])[0]
        it = d.get('item', {})
        figs = ''.join('<li onclick="ins(\'%s\',this)" title="click to append">%s</li>'
                       % (esc(d['id']), esc(f)) for f in m.get('figures', [])[:4])
        note = ('<span class="note">%s</span>' % esc(d['note'])) if d.get('note') else ''
        phr = (' &middot; ' + esc(', '.join(m.get('phrases', [])[:2]))) if m.get('phrases') else ''
        when = (it.get('published') or '')[:10]
        cards.append(CARD.format(
            ID=esc(d['id']), VIA=esc(m.get('via', 'stat')),
            VIACLS='rule' if 'rule' in (m.get('via') or '') else '',
            SCORE='%.2f' % d.get('score', 0), SOURCE=esc(it.get('source')),
            AUTHOR=('<span>%s</span>' % esc(it['author'])) if it.get('author') else '',
            WHEN=esc(when), IURL=esc(it.get('url')), ITITLE=esc(it.get('title')),
            ISUM=esc(it.get('summary'))[:400], MURL=esc(m.get('url')),
            MTITLE=esc(m.get('title')), FIGS=figs or '<li>(no figure extracted)</li>',
            DRAFT=esc(d.get('draft', '')), NOTE=note, PHR=phr))

    src = ', '.join('%s (%d)' % (s['name'], s['count']) for s in payload.get('sources', [])
                    if s['count'])
    page = PAGE.replace('{GEN}', esc(payload.get('generated', '')[:16].replace('T', ' '))) \
               .replace('{N}', str(len(payload.get('drafts', [])))) \
               .replace('{WIN}', str(payload.get('window_days', ''))) \
               .replace('{SRC}', esc(src) or 'none') \
               .replace('{CARDS}', '\n'.join(cards) or
                        '<p class="empty">Nothing matched above the bar this run.</p>')
    open(out, 'w', encoding='utf-8').write(page)
    return out
