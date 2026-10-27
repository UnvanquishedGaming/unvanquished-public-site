// Official EVE Online announcements — read-only, public, no secrets, no dependencies.
// Deployed automatically by Netlify as /.netlify/functions/eve-official-news
const FEEDS = [
  { kind: 'news', name: 'Official News', url: 'https://www.eveonline.com/rss/json/news' },
  { kind: 'dev', name: 'Dev Blog', url: 'https://www.eveonline.com/rss/json/dev-blogs' },
  { kind: 'patch', name: 'Patch Notes', url: 'https://www.eveonline.com/rss/json/patch-notes' },
];
const CACHE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=3600',
  'X-Content-Type-Options': 'nosniff',
};
const ERROR_HEADERS = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };

function asString(x) { return typeof x === 'string' ? x : ''; }
function shortText(x, max=220) {
  // Text only: never inject source markup into our website.
  const s = asString(x).replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max-1).trimEnd() + '…' : s;
}
function safeOfficialUrl(value) {
  const str = asString(value);
  if (!str) return null;
  try {
    const u = new URL(str, 'https://www.eveonline.com/');
    if (u.protocol !== 'https:' || !['www.eveonline.com','eveonline.com'].includes(u.hostname)) return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch { return null; }
}
function pickItems(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  for (const candidate of [json.items, json.entries, json.articles, json.posts, json.data?.items, json.data?.articles, json.data, json.channel?.item]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}
function dateISO(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function normalize(item, source) {
  if (!item || typeof item !== 'object') return null;
  const title=shortText(item.title || item.headline || item.name, 170);
  const url=safeOfficialUrl(item.link || item.url || item.href || item.canonicalUrl || item.guid);
  if (!title || !url) return null;
  return {
    title,
    url,
    date: dateISO(item.pubDate || item.published || item.date_published || item.publishDate || item.date || item.createdAt),
    summary: shortText(item.description || item.summary || item.contentSnippet || item.excerpt || '', 240),
    source: source.name,
    category: source.kind,
  };
}

export function createHandler(fetchImpl = fetch) {
  return async function handler(request) {
    if (request.method !== 'GET') return new Response(JSON.stringify({error:'Method not allowed'}), {status:405, headers:{...ERROR_HEADERS,Allow:'GET'}});
    const results = await Promise.allSettled(FEEDS.map(async source => {
      const response=await fetchImpl(source.url, {
        headers:{Accept:'application/json', 'User-Agent':'TheUnvanquished/1.0 (+https://unvanquishedgaming.com)'},
        signal:AbortSignal.timeout(9000),
      });
      if (!response.ok) throw new Error('Feed not available');
      const content = await response.json();
      const rows = pickItems(content);
      // Catch a source response format that changed instead of reporting a fake successful empty feed.
      if (!rows.length && !(Array.isArray(content) && content.length===0)) {
        throw new Error('Unexpected or empty feed format');
      }
      return rows.slice(0,35).map(item => normalize(item,source)).filter(Boolean);
    }));
    const good=results.filter(r=>r.status==='fulfilled');
    if (!good.length) return new Response(JSON.stringify({error:'Official EVE news temporarily unavailable',items:[]}),{status:503,headers:ERROR_HEADERS});
    const seen=new Set();
    const items=good.flatMap(r=>r.value).filter(x=>{
      const key=x.url.replace(/\/$/,'').toLowerCase();
      if(seen.has(key)) return false;seen.add(key);return true;
    }).sort((a,b)=>(b.date ? Date.parse(b.date) : 0)-(a.date ? Date.parse(a.date) : 0)).slice(0,36);
    return new Response(JSON.stringify({items,updatedAt:new Date().toISOString(),sourcesAvailable:good.length,sourcesTotal:FEEDS.length}),{status:200,headers:CACHE_HEADERS});
  };
}
export default createHandler();
