"""Turn an evidence pack into a comment draft.

Two modes. Without an API key it builds a scaffold from the matched piece's
own figures, which is enough to edit in thirty seconds. With ANTHROPIC_API_KEY
set it asks Claude for a finished draft in the site's voice.

Nothing here posts anything. Every draft lands in the queue for review.
"""
import os, re, json, urllib.request, urllib.error

MODEL = os.environ.get('SCARC_MODEL', 'claude-sonnet-5')

VOICE = """You write short public comments for Scarcinality, an economics site.

House voice, non-negotiable:
- Short sentences. Average around 12 words. Almost none over 25.
- No em dashes. US spelling. No exclamation marks. No emoji.
- Plain words. No jargon the reader would have to look up.
- Never partisan, never addressed to the author personally, never scolding.
- Lead with a concrete number, not with the framework's vocabulary.
- One idea only.

A comment must:
- Be 40 to 70 words.
- Cite exactly one figure from the supplied evidence, quoted accurately.
- Add something the post did not say. If you cannot, say so.
- End with the bare URL of the matched piece on its own line.

Never invent a number. Only use figures present in the evidence."""

PROMPT = """A public post:

TITLE: {title}
SOURCE: {source}{author}
TEXT: {summary}

The closest Scarcinality piece:

TITLE: {m_title}
URL: {m_url}
WHAT IT ARGUES: {m_pull}
FIGURES IT ESTABLISHES:
{figs}

Write the comment. If the post and the piece are not genuinely about the same
thing, reply with exactly: SKIP: <one line saying why>."""


def scaffold(pack):
    """Keyless fallback: a real starting point, not a placeholder."""
    if not pack['matches']:
        return None, 'no match'
    m = pack['matches'][0]
    fig = re.sub(r'\s+', ' ', (m['figures'] or [''])[0]).strip()
    if not fig:
        return None, 'no figure to quote'
    # Deliberately unfinished. A scaffold that reads like a finished comment
    # invites posting it unedited, and the connecting sentence is the part
    # that has to be judged against the specific post.
    body = ('%s\n\n[one line on why that bears on this post]\n\n%s'
            % (fig, m['url']))
    return body, None


def call_claude(pack, timeout=60):
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        return None, 'no ANTHROPIC_API_KEY'
    if not pack['matches']:
        return None, 'no match'
    it, m = pack['item'], pack['matches'][0]
    body = json.dumps({
        'model': MODEL, 'max_tokens': 400, 'system': VOICE,
        'messages': [{'role': 'user', 'content': PROMPT.format(
            title=it.get('title', ''), source=it.get('source', ''),
            author=(' / ' + it['author']) if it.get('author') else '',
            summary=(it.get('summary') or '')[:1500],
            m_title=m['title'], m_url=m['url'], m_pull=m['pull'],
            figs='\n'.join('- ' + f for f in m['figures']) or '- (none extracted)',
        )}],
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages', data=body,
        headers={'content-type': 'application/json', 'x-api-key': key,
                 'anthropic-version': '2023-06-01'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read())
        txt = ''.join(b.get('text', '') for b in d.get('content', [])).strip()
    except urllib.error.HTTPError as e:
        return None, 'api %s: %s' % (e.code, e.read()[:200].decode('utf8', 'replace'))
    except Exception as e:
        return None, 'api: %s' % e
    if txt.upper().startswith('SKIP'):
        return None, txt[:160]
    return txt, None


def make(pack):
    text, err = call_claude(pack)
    how = 'claude'
    if text is None:
        if err and err.upper().startswith('SKIP'):
            return dict(status='skipped', reason=err, draft='')
        text, err2 = scaffold(pack)
        how = 'scaffold'
        if text is None:
            return dict(status='skipped', reason=err2 or err, draft='')
    return dict(status='draft', how=how, draft=text,
                note=None if how == 'claude' else (err or 'no API key, scaffold only'))
