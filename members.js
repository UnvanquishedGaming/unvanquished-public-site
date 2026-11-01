'use strict';
(async()=>{
 const placeholders=document.getElementById('member-placeholder');
 if(!placeholders)return;
 const groups={
  ceo:document.getElementById('member-ceo'),
  leadership:document.getElementById('member-leadership'),
  member:document.getElementById('member-community')
 };
 const lists={
  ceo:document.getElementById('member-ceo-list'),
  leadership:document.getElementById('member-leadership-list'),
  member:document.getElementById('member-community-list')
 };
 const text=(tag,value,className)=>{
  const e=document.createElement(tag);
  e.textContent=String(value??'');
  if(className)e.className=className;
  return e;
 };
 function profileCard(entry,tier){
  const article=document.createElement('article');
  article.className='member-profile'+(tier==='ceo'?' member-profile-featured':'');
  const header=document.createElement('div');header.className='member-profile-header';
  const rank=tier==='ceo'?'CEO':(tier==='leadership'?(entry.roleTitle||'Leadership'):'Community member');
  header.append(text('span',rank,'member-profile-rank'));
  const title=text('h4',entry.eveName,'member-profile-name');
  header.append(title);
  if(entry.discordName)header.append(text('p','Discord: '+entry.discordName,'member-profile-discord'));
  article.append(header);
  if(entry.introduction)article.append(text('p',entry.introduction,'member-profile-intro'));
  if(Array.isArray(entry.games) && entry.games.length){
   const section=document.createElement('div');section.className='member-profile-detail';
   section.append(text('span','OTHER GAMES','member-profile-label'));
   section.append(text('p',entry.games.filter(x=>typeof x==='string'&&x.trim()).join(' · ')));
   article.append(section);
  }
  if(entry.memory){
   const section=document.createElement('div');section.className='member-profile-detail';
   section.append(text('span','FAVORITE UNVANQUISHED MEMORY','member-profile-label'));
   section.append(text('blockquote',entry.memory,'member-profile-memory'));
   article.append(section);
  }
  return article;
 }
 try{
  const response=await fetch('/content/members.json',{cache:'no-cache'});
  if(!response.ok)throw Error('Profiles unavailable');
  const data=await response.json();
  if(!Array.isArray(data.profiles))throw Error('Invalid profile data');
  const accepted=data.profiles.filter(p=>p&&p.approvedForPublicSite===true&&
    typeof p.eveName==='string'&&p.eveName.trim()&&
    ['ceo','leadership','member'].includes(p.tier));
  const order=(p)=>Number.isFinite(p.sortOrder)?p.sortOrder:999;
  const grouped={ceo:[],leadership:[],member:[]};
  for(const p of accepted)grouped[p.tier].push(p);
  let visible=0;
  for(const tier of ['ceo','leadership','member']){
   grouped[tier].sort((a,b)=>order(a)-order(b)||a.eveName.localeCompare(b.eveName));
   if(!grouped[tier].length)continue;
   for(const profile of grouped[tier])lists[tier].append(profileCard(profile,tier));
   groups[tier].hidden=false;
   visible+=grouped[tier].length;
  }
  if(visible)placeholders.hidden=true;
 }catch(error){
  // The introductory placeholder remains if the profile file is unavailable.
  console.warn('Member profiles could not be loaded.');
 }
})();
