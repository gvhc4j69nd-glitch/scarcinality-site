"""Where the monitor looks. Stdlib only.

Two of these work today with no credentials. The Meta Ad Library needs a
token, which needs identity confirmation at facebook.com/ID first, so it
returns nothing and says why until the token is present.

Deliberately absent: anything that reads Facebook Pages. Meta gates that
behind Page Public Content Access, and scraping it risks the Page.
"""
import os, re, json, time, urllib.parse, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

UA = 'Mozilla/5.0 (compatible; ScarcinalityMonitor/1.0; +https://www.scarcinality.com)'


def _get(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _clean(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    for a, b in (('&amp;', '&'), ('&#39;', "'"), ('&quot;', '"'), ('&nbsp;', ' '),
                 ('&lt;', '<'), ('&gt;', '>'), ('&apos;', "'")):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def _iso(struct_or_str):
    try:
        from email.utils import parsedate_to_datetime
        d = parsedate_to_datetime(struct_or_str)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- news search

def google_news(query, when='7d', limit=25):
    """Google News RSS. No key, no account. The practical way to catch a
    candidate talking about a topic, because it surfaces the coverage and the
    press release rather than the Facebook post itself."""
    q = urllib.parse.quote('%s when:%s' % (query, when))
    url = 'https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en' % q
    out = []
    try:
        root = ET.fromstring(_get(url))
    except Exception as e:
        return [], 'google_news(%s): %s' % (query, e)
    for item in root.iter('item'):
        g = lambda t: (item.findtext(t) or '')
        out.append(dict(
            source='news', query=query,
            title=_clean(g('title')),
            summary=_clean(g('description'))[:600],
            url=g('link'), published=_iso(g('pubDate')),
            author=_clean(g('{http://purl.org/dc/elements/1.1/}creator')) or '',
        ))
        if len(out) >= limit:
            break
    return out, None


# ------------------------------------------------------------------- feeds

def rss(url, label, limit=25):
    """Any RSS or Atom feed: candidate press releases, committee feeds."""
    out = []
    try:
        root = ET.fromstring(_get(url))
    except Exception as e:
        return [], 'rss(%s): %s' % (label, e)
    items = list(root.iter('item')) or list(root.iter('{http://www.w3.org/2005/Atom}entry'))
    for it in items[:limit]:
        def g(*names):
            for n in names:
                v = it.findtext(n)
                if v:
                    return v
            return ''
        link = g('link') or ''
        if not link:
            le = it.find('{http://www.w3.org/2005/Atom}link')
            link = le.get('href') if le is not None else ''
        out.append(dict(
            source='feed', query=label,
            title=_clean(g('title', '{http://www.w3.org/2005/Atom}title')),
            summary=_clean(g('description', 'summary',
                             '{http://www.w3.org/2005/Atom}summary'))[:600],
            url=link,
            published=_iso(g('pubDate', 'updated', '{http://www.w3.org/2005/Atom}updated')),
            author='',
        ))
    return out, None


# ------------------------------------------------------- federal register

def federal_register(term, days=7, limit=20):
    """Open JSON API, no key. Catches the rulemaking behind the talking point."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
    url = ('https://www.federalregister.gov/api/v1/documents.json'
           '?per_page=%d&order=newest'
           '&conditions[term]=%s&conditions[publication_date][gte]=%s'
           '&fields[]=title&fields[]=abstract&fields[]=html_url'
           '&fields[]=publication_date&fields[]=type'
           % (limit, urllib.parse.quote(term), since))
    try:
        d = json.loads(_get(url))
    except Exception as e:
        return [], 'federal_register(%s): %s' % (term, e)
    out = []
    for r in d.get('results', []):
        out.append(dict(
            source='federal_register', query=term,
            title=_clean(r.get('title')),
            summary=_clean(r.get('abstract'))[:600],
            url=r.get('html_url'),
            published=(r.get('publication_date') or '') + 'T00:00:00+00:00',
            author=r.get('type', ''),
        ))
    return out, None


# ----------------------------------------------------------- meta ad library

def ad_library(search_terms, page_ids=None, days=7, limit=40,
               token=None, countries=('US',)):
    """Political and issue ads, with full creative text.

    Needs FB_ADS_TOKEN. To get one: create a Meta developer app, then confirm
    identity and location at facebook.com/ID (the same process required to run
    ads about social issues, elections or politics). A system user token with
    the ads_archive scope is the right kind for a scheduled job.
    """
    token = token or os.environ.get('FB_ADS_TOKEN', '')
    if not token:
        return [], ('ad_library: no FB_ADS_TOKEN set. Confirm identity at '
                    'facebook.com/ID, create a system user token with ads_archive, '
                    'then export FB_ADS_TOKEN.')
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
    params = {
        'access_token': token,
        'search_terms': search_terms,
        'ad_reached_countries': json.dumps(list(countries)),
        'ad_active_status': 'ALL',
        'ad_delivery_date_min': since,
        'limit': str(limit),
        'fields': ','.join(['id', 'ad_creative_bodies', 'ad_creative_link_titles',
                            'page_name', 'page_id', 'ad_delivery_start_time',
                            'publisher_platforms', 'ad_snapshot_url']),
    }
    if page_ids:
        params['search_page_ids'] = json.dumps(list(page_ids))
    url = 'https://graph.facebook.com/v23.0/ads_archive?' + urllib.parse.urlencode(params)
    try:
        d = json.loads(_get(url))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get('error', {}).get('message', str(e))
        except Exception:
            msg = str(e)
        return [], 'ad_library: %s' % msg
    except Exception as e:
        return [], 'ad_library: %s' % e
    out = []
    for a in d.get('data', []):
        body = ' '.join(a.get('ad_creative_bodies') or [])
        out.append(dict(
            source='ad_library', query=search_terms,
            title=_clean(' '.join(a.get('ad_creative_link_titles') or []) or
                         (a.get('page_name') or 'Ad')),
            summary=_clean(body)[:900],
            url=a.get('ad_snapshot_url', ''),
            published=a.get('ad_delivery_start_time', ''),
            author=a.get('page_name', ''),
        ))
    return out, None
