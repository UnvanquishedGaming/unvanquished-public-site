'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeLink = url => {
  try { const u = new URL(url, window.location.href); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null; }
  catch { return null; }
};
const safeImage = path => {
  if (!path || typeof path !== 'string') return null;
  if (/^\/?assets\/[a-zA-Z0-9/_\-.]+$/.test(path)) return path;
  if (/^https:\/\//.test(path)) return safeLink(path);
  return null;
};
const emptyMessage = (title, copy) => `<div class="empty-state"><span class="eyebrow yellow">COMMUNITY NEWS</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
const dateFmt = (d, options = {month:'short',day:'numeric',year:'numeric'}) => new Intl.DateTimeFormat(undefined, options).format(d);
const parseDate = s => { const d = new Date(s); return Number.isFinite(d.getTime()) ? d : null; };
const sameDay = (a,b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const inUrl = value => value && safeLink(value) || null;

// This site is read-only for visitors. Data comes from JSON files edited by approved GitHub/CMS editors.
async function getData(path, fallback) {
  try {
    if (location.protocol === 'file:') return fallback; // file:// previews cannot reliably fetch local JSON
    const response = await fetch(`content/${path}`, {cache:'no-store'});
    if (!response.ok) throw new Error('Content unavailable');
    return await response.json();
  } catch { return fallback; }
}

function intro() {
  const menu = $('#nav-toggle');
  if (menu) menu.addEventListener('click', () => {
    const open = $('#main-nav').classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  $$('#main-nav a').forEach(a => a.addEventListener('click', () => {
    $('#main-nav')?.classList.remove('open');
    menu?.setAttribute('aria-expanded','false');
  }));
  if ($('#copyright-year')) $('#copyright-year').textContent = new Date().getFullYear();
}

function eventsSorted(list) { return (Array.isArray(list) ? list : []).filter(e => e && parseDate(e.start) && e.title).sort((a,b)=>new Date(a.start)-new Date(b.start)); }
function postsSorted(list) { return (Array.isArray(list) ? list : []).filter(p => p && p.title && p.published === true && parseDate(p.date)).sort((a,b)=>new Date(b.date)-new Date(a.date)); }
function plansFiltered(list) { return (Array.isArray(list) ? list : []).filter(p=>p && p.title && p.published === true); }

function renderHome(events, posts, plans) {
  const now = new Date();
  const upcoming = eventsSorted(events).filter(e=>new Date(e.start) >= new Date(now.getTime()-3600_000)).slice(0,2);
  if ($('#home-events')) $('#home-events').innerHTML = upcoming.length ? upcoming.map(e => `<p><strong>${esc(e.title)}</strong><br><small>${esc(dateFmt(new Date(e.start),{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</small></p>`).join('') : '<p>No events have been posted yet. Check Discord for spontaneous plans.</p>';
  const latest = postsSorted(posts)[0];
  if ($('#home-news')) $('#home-news').innerHTML = latest ? `<p><strong>${esc(latest.title)}</strong><br><small>${esc(dateFmt(new Date(latest.date)))}</small></p>` : '<p>No news published yet. Updates will appear here as they’re posted.</p>';
  const openPlans = plansFiltered(plans).filter(p=>p.status !== 'Completed');
  if ($('#home-plans')) $('#home-plans').innerHTML = openPlans.length ? `<p><strong>${esc(openPlans.length)} public objective${openPlans.length===1?'':'s'}</strong> listed on the planning board.</p><p>${esc(openPlans[0].title)}</p>` : '<p>No community plans have been published yet.</p>';
}

function renderNews(news) {
  const published=postsSorted(news);
  const list=$('#news-list'); if(!list)return;
  let category='all',search='';
  function render(){
    const shown=published.filter(p=>(category==='all'||p.category===category) && `${p.title} ${p.summary||''} ${p.body||''}`.toLowerCase().includes(search));
    if(!shown.length){list.innerHTML=emptyMessage(published.length?'NO MATCHING POSTS.':'NO POSTS YET.',published.length?'Try a different category or search term.':'News and stories will appear here when the community publishes them.');return;}
    list.innerHTML=shown.map(p=>{
      const cover=safeImage(p.image);
      return `<button type="button" class="news-article" data-post-id="${esc(p.id||p.title)}">${cover?`<img src="${esc(cover)}" alt="" loading="lazy">`:''}<span class="article-body"><small>${esc(p.category||'News')} // ${esc(dateFmt(new Date(p.date)))}</small><h3>${esc(p.title)}</h3><p>${esc(p.summary||'')}</p><span class="article-more">READ ARTICLE ↗</span></span></button>`;
    }).join('');
    $$('.news-article').forEach(btn=>btn.addEventListener('click',()=>{
      const p=shown.find(item=>String(item.id||item.title)===btn.dataset.postId); if(!p)return;
      const dialog=$('#article-dialog'),target=$('#article-content'),cover=safeImage(p.image);
      target.innerHTML=`<span class="article-date">${esc(p.category||'News')} // ${esc(dateFmt(new Date(p.date)))}</span><h2>${esc(p.title)}</h2>${cover?`<img src="${esc(cover)}" alt="" />`:''}<p class="article-text"></p>`;
      target.querySelector('.article-text').textContent=p.body||p.summary||'';
      if(dialog?.showModal)dialog.showModal();
    }));
  }
  $$('#news-filters [data-category]').forEach(btn=>btn.addEventListener('click',()=>{
    category=btn.dataset.category; $$('#news-filters button').forEach(b=>b.classList.toggle('selected',b===btn));render();
  }));
  $('#news-search')?.addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();render();});
  $('#article-close')?.addEventListener('click',()=>$('#article-dialog')?.close());
  $('#article-dialog')?.addEventListener('click',e=>{if(e.target.id==='article-dialog')e.target.close();});
  render();
}

function renderCalendar(events, config) {
  const grid=$('#calendar-grid'); if(!grid)return;
  const data=eventsSorted(events);
  const today=new Date(); let showing=new Date(today.getFullYear(),today.getMonth(),1),selected=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  function dayEvents(d){return data.filter(e=>sameDay(new Date(e.start),d));}
  function updateAside(){
    const title=$('#selected-day-title'),aside=$('#calendar-day-events'); if(!title||!aside)return;
    title.textContent=dateFmt(selected,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
    const items=dayEvents(selected);
    aside.innerHTML=items.length?items.map(e=>{
      const d=new Date(e.start),end=parseDate(e.end),href=safeLink(e.url);
      const time=dateFmt(d,{hour:'numeric',minute:'2-digit'})+(end?' – '+dateFmt(end,{hour:'numeric',minute:'2-digit'}):'');
      return `<div class="event-item"><small>${esc(e.type||'Community')} // ${esc(time)}</small><b>${esc(e.title)}</b><p>${esc(e.description||'')}</p>${href?`<a class="small-link" href="${esc(href)}" rel="noopener noreferrer" target="_blank">EVENT DETAILS ↗</a>`:''}</div>`;
    }).join(''):'<div class="empty-state"><h3>NOTHING SCHEDULED.</h3><p>Nothing is scheduled for this date. Check Discord for spontaneous activities.</p></div>';
  }
  function draw(){
    const first=new Date(showing.getFullYear(),showing.getMonth(),1);
    const starting=first.getDay(),days=new Date(showing.getFullYear(),showing.getMonth()+1,0).getDate();
    $('#month-title').textContent=dateFmt(first,{month:'long',year:'numeric'}).toUpperCase();
    let html='';
    for(let cell=0;cell<42;cell++){
      const date=new Date(showing.getFullYear(),showing.getMonth(),cell-starting+1);
      const outside=date.getMonth()!==showing.getMonth();
      const classes=['cal-day',outside?'is-muted':'',sameDay(date,today)?'is-today':'',sameDay(date,selected)?'is-selected':''].filter(Boolean).join(' ');
      const count=dayEvents(date).length;
      const iso=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
      html+=`<button class="${classes}" data-cal-date="${iso}" aria-label="${esc(dateFmt(date,{weekday:'long',month:'long',day:'numeric'}))}${count?`, ${count} scheduled events`:''}"><span>${date.getDate()}</span>${count?`<span class="cal-count">${count} EVENT${count>1?'S':''}</span>`:''}</button>`;
    }
    grid.innerHTML=html;
    $$('[data-cal-date]').forEach(btn=>btn.addEventListener('click',()=>{
      const [y,m,d]=btn.dataset.calDate.split('-').map(Number);
      selected=new Date(y,m-1,d);showing=new Date(y,m-1,1);draw();
    }));
    updateAside();
  }
  $('#cal-prev')?.addEventListener('click',()=>{showing=new Date(showing.getFullYear(),showing.getMonth()-1,1); selected=new Date(showing);draw();});
  $('#cal-next')?.addEventListener('click',()=>{showing=new Date(showing.getFullYear(),showing.getMonth()+1,1);selected=new Date(showing);draw();});
  $('#cal-today')?.addEventListener('click',()=>{showing=new Date(today.getFullYear(),today.getMonth(),1);selected=new Date(today.getFullYear(),today.getMonth(),today.getDate());draw();});
  const evUrl=safeLink(config.eventsPageUrl);
  if(evUrl){const el=$('#discord-events-link');el.href=evUrl;el.classList.remove('hidden');}
  // Only load a confirmed calendar.google.com embed URL (avoid third-party arbitrary iframe injection).
  try{
    const raw=config.publicCalendarEmbedUrl;
    if(raw){const u=new URL(raw);if(u.protocol==='https:' && (u.hostname==='calendar.google.com' || u.hostname==='www.google.com') && u.pathname.includes('/calendar/')){
      $('#gcal-wrap').classList.remove('hidden'); $('#gcal-frame').src=u.href;
    }}
  }catch{}
  draw();
}

function renderKillboard(config){
  const url=safeLink(config.zkillboardCorporationUrl);if(!url)return;
  try {const u=new URL(url);if(!/(^|\.)zkillboard\.com$/.test(u.hostname) || !/^\/corporation\/\d+\/?$/.test(u.pathname))return;}catch{return;}
  $('#killboard-status').textContent='OFFICIAL CORPORATION PROFILE CONNECTED';
  $('#killboard-copy').textContent='Open the public corporation profile on zKillboard to see actual kills and losses. This website does not invent combat results.';
  const link=$('#killboard-link');link.href=url;link.classList.remove('hidden');
}
function renderPlans(plans){
  const list=$('#roadmap-list');if(!list)return;const data=plansFiltered(plans);let status='all';
  function draw(){
    const selected=data.filter(p=>status==='all'||p.status===status);
    list.innerHTML=selected.length?selected.map(p=>{
      const className=p.status==='In Progress'?'in-progress':p.status==='Completed'?'completed':'';
      return `<article class="plan-card"><span class="plan-label ${className}">${esc(p.status||'Proposed').toUpperCase()}</span><h3>${esc(p.title)}</h3><p>${esc(p.description||'')}</p>${p.target?`<div class="plan-date">TARGET / ${esc(p.target)}</div>`:''}</article>`;
    }).join(''):emptyMessage(data.length?'NO ITEMS IN THIS CATEGORY.':'PLANS REQUIRE AUTHORIZATION.',data.length?'Switch the status filter to see other published objectives.':'No public roadmap items have been published yet. Proposed projects will be marked clearly as proposals.');
  }
  $$('#plan-filters [data-plan]').forEach(btn=>btn.addEventListener('click',()=>{status=btn.dataset.plan;$$('#plan-filters button').forEach(b=>b.classList.toggle('selected',b===btn));draw();}));
  draw();
}
// Media URLs are configured in content/site.json. A recruitment embed loads only after
// someone clicks Play, and only trusted youtube.com / youtu.be video URLs are accepted.
function youtubeVideoId(input) {
  try {
    if (!input || typeof input !== 'string') return null;
    const u = new URL(input);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
      else if (/^\/(shorts|embed|live)\//.test(u.pathname)) id = u.pathname.split('/')[2] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
function youtubeChannelUrl(input) {
  try {
    if (!input || typeof input !== 'string') return null;
    const u = new URL(input);
    if (u.protocol !== 'https:' || !['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname.toLowerCase())) return null;
    if (!/^\/(?:@[A-Za-z0-9_.-]+|channel\/[A-Za-z0-9_-]+|c\/[A-Za-z0-9_.-]+|user\/[A-Za-z0-9_.-]+)\/?$/.test(u.pathname)) return null;
    return u.href;
  } catch { return null; }
}
function renderMediaLinks(config) {
  const channelUrl = youtubeChannelUrl(config.youtubeChannelUrl);
  if (channelUrl) {
    for (const selector of ['#youtube-channel-link','#footer-youtube-link']) {
      const link = $(selector);
      if (link) { link.href = channelUrl; link.classList.remove('hidden'); }
    }
    $('#youtube-link-pending')?.classList.add('hidden');
  }
  const videoId = youtubeVideoId(config.recruitmentVideoUrl);
  if (!videoId) return;
  const player = $('#recruitment-player');
  const play = $('#film-play');
  if (!player || !play) return;
  $('#film-pending')?.classList.add('hidden');
  play.classList.remove('hidden');
  const desc = $('#film-description');
  if (desc) desc.textContent = 'Watch our recruitment film here, or visit the community YouTube channel for more videos when available.';
  play.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.className = 'film-iframe';
    frame.title = 'The Unvanquished recruitment film';
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    // Only remove the decorative preview after an intentional click.
    player.replaceChildren(frame);
  }, {once: true});
}

function renderEnlist(config){
  const link=$('#recruit-discord'),note=$('#discord-empty');
  const target=safeLink(config.discordInviteUrl);
  if(target && /^https:\/\/(discord\.gg|discord\.com|www\.discord\.com)\//.test(target)) {
    if(link){link.href=target;link.classList.remove('hidden');} note?.classList.add('hidden');
  }
  $('#copy-name')?.addEventListener('click',async()=>{
    const name=config.corporationName||'The Unvanquished';
    try{await navigator.clipboard.writeText(name);$('#copy-name').textContent='COPIED TO CLIPBOARD ✓';$('#copy-feedback').textContent='Corporation name copied.';}
    catch{window.prompt('Copy the corporation name:',name);$('#copy-feedback').textContent='Select and copy the corporation name in the dialog.';}
  });
}

(async function init(){
  intro();
  const [config,news,events,plans]=await Promise.all([
    getData('site.json',{}),getData('news.json',[]),getData('events.json',[]),getData('plans.json',[])
  ]);
  renderMediaLinks(config);
  const page=document.body.dataset.page;
  if(page==='index')renderHome(events,news,plans);
  if(page==='news')renderNews(news);
  if(page==='calendar')renderCalendar(events,config);
  if(page==='killboard')renderKillboard(config);
  if(page==='plans')renderPlans(plans);
  if(page==='enlist')renderEnlist(config);
})();
