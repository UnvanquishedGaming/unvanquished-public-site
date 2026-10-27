/* The Unvanquished — Public zKillboard activity feed (read-only).
 * V1 uses zKillboard's documented CORS-enabled public API and EVE ESI's public
 * universe name resolution endpoint. No account, API token, or server storage.
 * The requesting browser caches public records for one hour to limit traffic.
 * Code prepared as a staged update; deployment requires approval.
 */
(() => {
  'use strict';
  const CORP_ID = 98827058;
  const PROFILE_URL = `https://zkillboard.com/corporation/${CORP_ID}/`;
  const FEED_URL = `https://zkillboard.com/api/corporationID/${CORP_ID}/`;
  const NAMES_URL = 'https://esi.evetech.net/latest/universe/names/?datasource=tranquility';
  const CACHE_KEY = `unvanquished-public-kills-v1-${CORP_ID}`;
  const CACHE_TTL = 60 * 60 * 1000;
  const RECENT_COUNT = 10;

  const page = document.body?.dataset.page;
  if (!['index', 'killboard'].includes(page)) return;

  function style() {
    const sheet = document.createElement('style');
    sheet.textContent = `
      .uv-killfeed{margin-top:30px;border-top:1px solid #66552d;padding-top:28px}
      .uv-killfeed-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
      .uv-killfeed-header h2{font-size:clamp(30px,3.7vw,48px);margin:0}
      .uv-killfeed-header em{font-style:normal;color:var(--gold,#f4c647)}
      .uv-killfeed-note{color:#afb9bc;font-size:13px;margin-bottom:15px}
      .uv-killfeed-grid{display:grid;gap:8px}
      .uv-killfeed-item{display:grid;grid-template-columns:84px minmax(180px,1.3fr) minmax(140px,1fr) minmax(110px,.7fr);
        align-items:center;gap:14px;padding:15px 17px;color:inherit;text-decoration:none;border:1px solid #414d51;background:#182126}
      .uv-killfeed-item:hover,.uv-killfeed-item:focus-visible{border-color:#d7ad47;background:#242d30}
      .uv-killfeed-label{font:700 11px var(--font-mono,monospace);letter-spacing:.09em;color:#161512;
        padding:5px 7px;text-align:center;background:#f4c647}
      .uv-killfeed-label.loss{color:#fff;background:#a84037}
      .uv-killfeed-ship{font:800 23px var(--font-display,Arial,sans-serif);line-height:1.1;overflow-wrap:anywhere}
      .uv-killfeed-meta{font-size:13px;color:#bec6c8;line-height:1.35;white-space:pre-line}
      .uv-killfeed-value{font:700 16px var(--font-mono,monospace);text-align:right}
      .uv-killfeed-message{border:1px solid #485154;padding:20px;color:#bec6c8}
      .uv-killfeed-profile{font:700 13px var(--font-mono,monospace);color:var(--gold,#f4c647);text-decoration:underline}
      .uv-home-kill{display:block;margin:2px 0 0;text-decoration:none;color:inherit}
      .uv-home-kill strong{display:block;font-size:17px;line-height:1.25}
      .uv-home-kill small{color:#c3cbcc;display:block;margin-top:6px}
      .uv-home-label{font:800 10px var(--font-mono,monospace);letter-spacing:.08em;color:#f4c647}
      .uv-home-label.loss{color:#ff958b}
      @media(max-width:800px){.uv-killfeed-item{grid-template-columns:68px 1fr;gap:8px 12px}.uv-killfeed-value{text-align:left;grid-column:2}.uv-killfeed-meta{grid-column:2}}
    `;
    document.head.appendChild(sheet);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  const fmtDate = iso => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'}).format(d);
  };
  const fmtISK = n => {
    if (!Number.isFinite(n)) return 'Value unavailable';
    if (n >= 1e12) return `${(n/1e12).toFixed(2)}t ISK`;
    if (n >= 1e9) return `${(n/1e9).toFixed(2)}b ISK`;
    if (n >= 1e6) return `${(n/1e6).toFixed(1)}m ISK`;
    if (n >= 1e3) return `${(n/1e3).toFixed(1)}k ISK`;
    return `${Math.round(n)} ISK`;
  };

  function cacheRead() {
    try {
      const obj = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return obj && Array.isArray(obj.items) && Number.isFinite(obj.time) ? obj : null;
    } catch { return null; }
  }
  function cacheWrite(items) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(), items})); }
    catch { /* private browsing, low storage, and restrictive browsers are okay */ }
  }
  async function resolveNames(rows) {
    const ids = [...new Set(rows.flatMap(row => [row.shipId,row.systemId,row.victimId])
      .filter(id => Number.isSafeInteger(id) && id > 0))];
    if (!ids.length) return {};
    try {
      const response = await fetch(NAMES_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(ids), mode:'cors', cache:'default'
      });
      if (!response.ok) return {};
      const results = await response.json();
      if (!Array.isArray(results)) return {};
      return Object.fromEntries(results.filter(v => v && Number.isSafeInteger(v.id) && typeof v.name==='string')
        .map(v => [v.id, v.name]));
    } catch { return {}; }
  }
  async function fetchItems() {
    const response = await fetch(FEED_URL, {method:'GET', mode:'cors', cache:'default'});
    if (!response.ok) throw new Error(`zKillboard returned HTTP ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json)) throw new Error('Unexpected feed response');
    const rows = json.filter(r => r && Number.isSafeInteger(r.killmail_id) && r.victim && r.killmail_time)
      .sort((a,b) => new Date(b.killmail_time)-new Date(a.killmail_time)).slice(0,RECENT_COUNT)
      .map(r => ({
        id:r.killmail_id,
        at:r.killmail_time,
        side:Number(r.victim.corporation_id)===CORP_ID?'loss':'kill',
        shipId:Number(r.victim.ship_type_id),
        systemId:Number(r.solar_system_id),
        victimId:Number(r.victim.character_id),
        value:Number(r.zkb?.totalValue)
      }));
    const names = await resolveNames(rows);
    return rows.map(r => ({
      id:r.id, at:r.at, side:r.side,
      ship:names[r.shipId] || (Number.isSafeInteger(r.shipId) ? `Ship #${r.shipId}` : 'Unknown ship'),
      system:names[r.systemId] || (Number.isSafeInteger(r.systemId) ? `System #${r.systemId}` : 'Unknown system'),
      victim:names[r.victimId] || 'Unknown pilot',
      value:Number.isFinite(r.value)?r.value:null
    }));
  }

  function homepageTarget() {
    const link = Array.from(document.querySelectorAll('.brief-card a[href="killboard.html"]'))[0];
    return link?.closest('.brief-card')?.querySelector('.brief-body') || null;
  }
  function largeTarget() {
    const combat = document.querySelector('.combat-layout');
    if (!combat || !combat.parentNode) return null;
    const wrap = el('section','uv-killfeed');
    const header = el('div','uv-killfeed-header');
    const title = el('h2');
    title.append('LATEST ', el('em', '', 'ACTIVITY.'));
    const profile = el('a','uv-killfeed-profile','VIEW FULL HISTORY ↗');
    profile.href = PROFILE_URL; profile.target = '_blank'; profile.rel = 'noopener noreferrer';
    header.append(title,profile);
    wrap.append(header,el('p','uv-killfeed-note','Public zKillboard killmails • times in your local time zone • API may lag by at least five minutes'));
    const list=el('div','uv-killfeed-grid'); list.id='uv-killfeed-list';
    wrap.appendChild(list);
    combat.after(wrap);
    return list;
  }
  function message(target, message) {
    if (!target) return;
    target.replaceChildren(el('p', page==='index'?'':'uv-killfeed-message',message));
  }
  function renderHome(target, items, isStale) {
    if (!target) return;
    target.replaceChildren();
    if (!items.length) return message(target, 'No public combat records found yet.');
    const k=items[0];
    const a=el('a','uv-home-kill');
    a.href=`https://zkillboard.com/kill/${k.id}/`;
    a.target='_blank';a.rel='noopener noreferrer';
    a.append(el('span',`uv-home-label ${k.side}`,k.side==='loss'?'LATEST LOSS':'LATEST KILL'));
    a.append(el('strong','',k.ship));
    a.append(el('small','',`${k.system} · ${fmtISK(k.value)} · ${fmtDate(k.at)}`));
    target.appendChild(a);
    if (isStale) target.append(el('small','','Showing cached activity; feed unavailable right now.'));
  }
  function renderList(target, items, isStale) {
    if (!target) return;
    target.replaceChildren();
    if (!items.length) return message(target, 'No public killmails found for this corporation.');
    for (const k of items) {
      const a=el('a','uv-killfeed-item');
      a.href=`https://zkillboard.com/kill/${k.id}/`;
      a.target='_blank'; a.rel='noopener noreferrer';
      a.append(el('span',`uv-killfeed-label ${k.side}`,k.side==='loss'?'LOSS':'KILL'));
      a.append(el('strong','uv-killfeed-ship',k.ship));
      a.append(el('div','uv-killfeed-meta',`${k.system}\nVictim: ${k.victim}\n${fmtDate(k.at)}`));
      a.append(el('strong','uv-killfeed-value',fmtISK(k.value)));
      a.setAttribute('aria-label',`${k.side}: ${k.ship} in ${k.system}, ${fmtISK(k.value)}`);
      target.appendChild(a);
    }
    if (isStale) target.append(el('p','uv-killfeed-note','Showing cached results. Live feed is temporarily unavailable.'));
  }
  async function init() {
    style();
    const target=page==='index'?homepageTarget():largeTarget();
    if (!target) return;
    const cached=cacheRead();
    if (cached?.items.length) (page==='index'?renderHome:renderList)(target,cached.items,Date.now()-cached.time>=CACHE_TTL);
    else message(target,'Loading recent public killmails…');
    if (cached && Date.now()-cached.time<CACHE_TTL) return;
    try {
      const items=await fetchItems();
      cacheWrite(items);
      (page==='index'?renderHome:renderList)(target,items,false);
    } catch {
      if (cached) (page==='index'?renderHome:renderList)(target,cached.items,true);
      else message(target,'The killmail feed is temporarily unavailable. Use the corporation zKillboard link for the full history.');
    }
  }
  init();
})();
