/**
 * The Unvanquished: verified official EVE Online events.
 * Public read-only Netlify function; no login, user-supplied URLs, or secrets.
 * V1 combines dates explicitly verified against official EVE announcements
 * with a deliberately narrow headline parser for NEW, clearly dated launches.
 * Uncertain dates are never inferred from arbitrary article text.
 */
const NEWS_URL = 'https://www.eveonline.com/rss/json/news';
const ALLOWED_HOSTS = new Set(['www.eveonline.com', 'eveonline.com']);
const CACHE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=3600',
  'X-Content-Type-Options': 'nosniff',
};

// Each entry has been checked against a specific OFFICIAL article. End dates are inclusive.
// Review/update on an official schedule change; these are not live calendar API entries.
const VERIFIED = Object.freeze([
  {
    id: 'eve:crimson-harvest-2026', title: 'Crimson Harvest 2026',
    startDate: '2026-10-06', endDate: '2026-11-03',
    description: 'Official EVE Online seasonal event. See the developer announcement for details and rewards.',
    url: 'https://www.eveonline.com/news/view/crimson-harvest-the-bloodgates-are-open',
  },
  {
    id: 'eve:at-xxii-finals-2026', title: 'Alliance Tournament XXII Finals',
    startDate: '2026-10-31', endDate: '2026-11-01',
    description: 'Official Alliance Tournament XXII finals broadcast weekend.',
    url: 'https://www.eveonline.com/news/view/announcing-alliance-tournament-xxii',
  },
  {
    id: 'eve:fractured-skies-launch-2026', title: 'Fractured Skies Expansion Launch',
    startDate: '2026-11-10', endDate: '2026-11-10',
    description: 'Official release date of the Fractured Skies expansion.',
    url: 'https://www.eveonline.com/news/view/fractured-skies-expansion-arrives-10-nov',
  },
]);

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value, 'https://www.eveonline.com/');
    return (u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname) && !u.username && !u.password &&
      u.pathname.startsWith('/news/view/')) ? u.href : null;
  } catch { return null; }
}
function normalizeLink(u) { return u.replace(/\/?$/, '').toLowerCase(); }
function dateValid(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s+'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s;
}
function short(value, cap) {
  const s = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').trim() : '';
  return s.length > cap ? s.slice(0, cap - 1).trimEnd() + '…' : s;
}
function dateFor(year, month, day) {
  const y = Number(year), m = Number(month), d = Number(day);
  const s = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  return dateValid(s) ? s : null;
}
function toEvent(record, status) {
  const startDate = record.startDate;
  const endDate = record.endDate || startDate;
  if (!dateValid(startDate) || !dateValid(endDate) || endDate < startDate || !safeUrl(record.url)) return null;
  return {
    id: record.id, title: record.title, type: 'Official EVE', source: 'EVE Online',
    // Keep ISO timestamps for the existing site's sorting logic; all-day placement uses startDate/endDate.
    start: `${startDate}T12:00:00Z`, end: `${endDate}T12:00:00Z`,
    startDate, endDate, allDay: true,
    description: short(record.description, 250), url: safeUrl(record.url), verification: status,
  };
}
function feedEntries(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  for (const candidate of [json.items,json.entries,json.articles,json.posts,json.data?.items,json.data?.articles,json.data]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}
function parseClearHeadline(item) {
  if (!item || typeof item !== 'object') return null;
  const title = short(item.title || item.headline, 150);
  const url = safeUrl(item.link || item.url || item.href || item.canonicalUrl);
  const published = item.pubDate || item.published || item.date_published || item.date || item.publishDate;
  const publishedTime = published ? new Date(published).getTime() : NaN;
  if (!url || !Number.isFinite(publishedTime) || !title) return null;
  // A retail sale, patch-note article, etc., must never become an event merely because it mentions a date.
  if (/\b(sale|discount|offer|plex|skin|store|pack|patch notes|ban report|vote|survey)\b/i.test(title)) return null;
  if (!/\b(expansion|tournament|event|harvest|winter nexus|gm week|fanfest|festival)\b/i.test(title)) return null;
  // Conservative automatic detection: a single, explicit day in a launch/start headline.
  // Date-range events without reliable structured dates require an approved verified entry above.
  const match = title.match(/^(.+?)\s+(?:arrives|launches|begins|starts|opens|returns)\s+(?:on\s+)?(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{4}))?\s*[.!]?$/i);
  if (!match) return null;
  const month = MONTHS[match[3].toLowerCase()];
  const publishedYear = new Date(publishedTime).getUTCFullYear();
  let year = match[4] ? Number(match[4]) : publishedYear;
  if (!match[4] && month === 1 && new Date(publishedTime).getUTCMonth() === 11) year += 1;
  const startDate = dateFor(year, month, Number(match[2]));
  if (!startDate) return null;
  const eventTime = Date.parse(`${startDate}T12:00:00Z`);
  // Ignore old recaps and dates more than ~6 months from an announcement.
  if (eventTime < publishedTime - 5*86400000 || eventTime > publishedTime + 180*86400000) return null;
  return {
    id: 'eve:auto:' + new URL(url).pathname.split('/').pop(),
    title: short(match[1], 110), startDate, endDate: startDate,
    description: `Official EVE announcement: ${title}. Check the original article for event details and time.`,
    url,
  };
}
export function createHandler(fetchImpl = fetch, now = () => new Date()) {
  return async function handler(request) {
    if (request.method !== 'GET') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...CACHE_HEADERS,Allow:'GET'}});
    const today = now().toISOString().slice(0,10);
    const cutoffPast = new Date(Date.parse(`${today}T00:00:00Z`) - 60*86400000).toISOString().slice(0,10);
    const cutoffFuture = new Date(Date.parse(`${today}T00:00:00Z`) + 400*86400000).toISOString().slice(0,10);
    const verified = VERIFIED.map(x=>toEvent(x,'verified-official-article')).filter(Boolean);
    let automated = [], sourceStatus = 'unavailable';
    try {
      const response = await fetchImpl(NEWS_URL, {
        headers: {Accept:'application/json','User-Agent':'TheUnvanquished/1.0 (+https://unvanquishedgaming.com)'},
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('News source unavailable');
      const data = await response.json();
      const items = feedEntries(data);
      if (!items.length) throw new Error('Unrecognized or empty source');
      automated = items.slice(0,50).map(parseClearHeadline).filter(Boolean).map(x=>toEvent(x,'explicit-headline-date')).filter(Boolean);
      sourceStatus = 'connected';
    } catch { /* Static verified events still display; do not create guessed events. */ }
    const seenIds = new Set(), seenUrls = new Set();
    const events = [...verified,...automated].filter(e => {
      // Same announcement may appear in both verified and automatic sets. Keep the verified multi-day record.
      const u = normalizeLink(e.url);
      if (e.endDate < cutoffPast || e.startDate > cutoffFuture || seenIds.has(e.id) || seenUrls.has(u)) return false;
      seenIds.add(e.id);seenUrls.add(u);return true;
    }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
    return new Response(JSON.stringify({events,sourceStatus,updatedAt:now().toISOString(),note:'Only explicitly verified dates or unambiguous dated launch headlines are included.'}),{status:200,headers:CACHE_HEADERS});
  };
}
export default createHandler();
