/* The Unvanquished — official EVE news, separate from community CMS stories.
 * Insert with <script defer src="eve-official-news.js"></script> in index.html and news.html.
 */
(() => {
  'use strict';
  const endpoint='/.netlify/functions/eve-official-news';
  const home=document.body?.dataset.page==='index';
  const news=document.body?.dataset.page==='news';
  if (!home && !news) return;
  const css=`
  .eve-feed-section{padding-top:12px;padding-bottom:40px;border-bottom:1px solid #464d50}
  .eve-feed-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:25px;flex-wrap:wrap}
  .eve-feed-head h2{font-size:clamp(2.2rem,3.9vw,4.4rem);margin:0}
  .eve-feed-head h2 em{font-style:normal;color:var(--gold)}
  .eve-feed-link{color:var(--gold);font:800 17px var(--font-display);white-space:nowrap}
  .eve-feed-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .eve-feed-card{min-width:0;display:flex;flex-direction:column;gap:10px;background:#172126;border:1px solid #4b565b;padding:22px;transition:border-color .15s}
  .eve-feed-card:hover,.eve-feed-card:focus-visible{border-color:var(--gold)}
  .eve-feed-source{font:700 10px var(--font-mono);letter-spacing:.11em;color:var(--gold)}
  .eve-feed-card h3{font:800 27px/1.03 var(--font-display);margin:0}
  .eve-feed-card p{color:#c1c8cb;margin:0;font-size:15px}
  .eve-feed-card time{margin-top:auto;color:#9da7ac;font:600 11px var(--font-mono)}
  .eve-feed-controls{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px}
  .eve-feed-filter{background:#20292e;color:var(--cream);border:1px solid #566166;padding:7px 12px;font:700 12px var(--font-mono)}
  .eve-feed-filter[aria-pressed="true"]{background:var(--gold);color:#151819;border-color:var(--gold)}
  .eve-feed-status{background:#162026;border:1px solid #414b50;padding:17px;color:#c9cece}
  .eve-feed-home{border-top:1px solid #414b50;margin-top:14px;padding-top:13px}
  .eve-feed-home small{font:700 10px var(--font-mono);color:var(--gold)}
  .eve-feed-home a{display:block;text-decoration:underline;text-decoration-color:#70602e;text-underline-offset:3px;font-weight:700;margin-top:4px}
  .eve-feed-home time{font:600 10px var(--font-mono);color:#a5b0b4}
  @media(max-width:950px){.eve-feed-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:650px){.eve-feed-list{grid-template-columns:1fr}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.append(style);
  const officialUrl = 'https://www.eveonline.com/news';
  function elem(tag, className, text) {const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el;}
  function officialLink(url) {
    try {const u=new URL(url);return u.protocol==='https:'&&['www.eveonline.com','eveonline.com'].includes(u.hostname) ? u.href : null;}
    catch{return null;}
  }
  function humanDate(value){if(!value)return 'Publication date unavailable';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(d):'Publication date unavailable';}
  function makeCard(item){
    const href=officialLink(item.url);if(!href)return null;
    const a=elem('a','eve-feed-card');a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    a.append(elem('span','eve-feed-source',{'news':'OFFICIAL EVE NEWS','dev':'DEV BLOG','patch':'PATCH NOTES'}[item.category]||'OFFICIAL EVE'));
    a.append(elem('h3','',item.title));
    if(item.summary)a.append(elem('p','',item.summary));
    const time=elem('time','',humanDate(item.date));if(item.date)time.dateTime=item.date;a.append(time);
    return a;
  }
  let list=null,status=null,selected='all', allItems=[];
  if(news){
    const main=document.querySelector('main');const existing=main?.querySelector('.section.shell');
    if(existing){
      const section=elem('section','section shell eve-feed-section');section.id='official-eve-news';
      const head=elem('div','eve-feed-head');const h=elem('div');h.append(elem('span','eyebrow yellow','AUTOMATIC OFFICIAL FEEDS'));
      const title=elem('h2');title.append('FROM ');title.append(elem('em','', 'NEW EDEN.'));h.append(title);head.append(h);
      const feedLink=elem('a','eve-feed-link','ALL EVE ANNOUNCEMENTS ↗');feedLink.href=officialUrl;feedLink.target='_blank';feedLink.rel='noopener noreferrer';head.append(feedLink);section.append(head);
      const controls=elem('div','eve-feed-controls');
      for(const [key,label] of [['all','ALL OFFICIAL'],['news','NEWS'],['dev','DEV BLOGS'],['patch','PATCH NOTES']]){
        const button=elem('button','eve-feed-filter',label);button.type='button';button.setAttribute('aria-pressed',String(key===selected));
        button.addEventListener('click',()=>{selected=key;controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();});
        controls.append(button);
      }
      section.append(controls);status=elem('p','eve-feed-status','Checking official EVE announcements…');section.append(status);
      list=elem('div','eve-feed-list');list.setAttribute('aria-live','polite');section.append(list);
      existing.before(section);
    }
  }
  function draw(){
    if(!list)return;
    list.replaceChildren();
    const items=allItems.filter(i=>selected==='all'||i.category===selected).slice(0,9);
    const cards=items.map(makeCard).filter(Boolean);if(cards.length)list.append(...cards);
    if(status)status.textContent=cards.length?'':(allItems.length?'No articles in this category yet.':'No official announcements available right now.');
    if(status)status.hidden=cards.length>0;
  }
  function addHome(items){
    const host=document.getElementById('home-news');if(!host)return;
    // A sibling rather than a child: existing app.js periodically sets #home-news.innerHTML.
    const box=elem('div','eve-feed-home');const title=elem('small','', 'LATEST OFFICIAL EVE NEWS');box.append(title);
    const first=items.find(item=>officialLink(item.url));
    if(first){const a=elem('a','',first.title);a.href=first.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);box.append(elem('time','',humanDate(first.date)));}
    else {const a=elem('a','', 'View official EVE news');a.href=officialUrl;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}
    host.insertAdjacentElement('afterend',box);
  }
  fetch(endpoint,{headers:{Accept:'application/json'}})
    .then(response=>{if(!response.ok)throw new Error('News source unavailable');return response.json();})
    .then(data=>{
      allItems=Array.isArray(data.items)?data.items:[];
      if(news)draw();
      if(home)addHome(allItems);
    })
    .catch(()=>{
      if(news && status)status.textContent='Official EVE updates are temporarily unavailable. Our community news below is unaffected.';
      if(home)addHome([]);
    });
})();
