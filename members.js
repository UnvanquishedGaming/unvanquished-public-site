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
  article.className='member-profile';

  const header=document.createElement('div');
  header.className='member-profile-header';
  const role=tier==='ceo'?'CEO':(tier==='leadership'?(entry.roleTitle||'Leadership'):'Community member');
  header.append(text('span',role,'member-profile-rank'));
  header.append(text('h4',entry.displayName||entry.eveName,'member-profile-name'));
  const eveNames=Array.isArray(entry.eveCharacters)&&entry.eveCharacters.length
   ? entry.eveCharacters.filter(n=>typeof n==='string'&&n.trim()).join(' · ')
   : entry.eveName;
  header.append(text('p','EVE: '+eveNames,'member-profile-meta'));
  if(entry.discordName)header.append(text('p','Discord: '+entry.discordName,'member-profile-meta'));
  article.append(header);

  const makeSection=(label)=>{
   const section=document.createElement('section');
   section.className='member-profile-detail';
   section.append(text('h5',label,'member-profile-label'));
   article.append(section);
   return section;
  };
  const about=makeSection('ABOUT');
  about.append(text('p',entry.introduction||'Introduction coming soon.','member-profile-intro'));
  // Extra anecdotes remain inside ABOUT so every profile has the same primary sections.
  if(entry.story){
   const paragraph=document.createElement('p');
   paragraph.className='member-profile-anecdote';
   paragraph.append(text('strong',(entry.storyTitle||'A community story')+': '));
   paragraph.append(document.createTextNode(entry.story));
   about.append(paragraph);
  }
  const games=makeSection('OTHER GAMES');
  const otherGames=Array.isArray(entry.games)
   ? entry.games.filter(n=>typeof n==='string'&&n.trim()).join(' · ') : '';
  games.append(text('p',otherGames||'Not listed.'));
  const memory=makeSection('FAVORITE UNVANQUISHED MEMORY');
  memory.append(text('blockquote',entry.memory||'Story coming soon.','member-profile-memory'));
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
