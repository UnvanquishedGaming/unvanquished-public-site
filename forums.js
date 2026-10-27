'use strict';
(()=>{
const $=s=>document.querySelector(s);
const categories=[{id:'general',label:'General Discussion'},{id:'eve-guides',label:'EVE Guides'}];
const state={topics:[],filter:'all',query:'',topic:null,posting:false,siteKey:null,widget:null,mode:'topic'};
const text=(tag,cls,value)=>{const n=document.createElement(tag);n.className=cls||'';n.textContent=String(value??'');return n;};
const name=id=>categories.find(c=>c.id===id)?.label||'Community';
const note=s=>$('#forum-status').textContent=s;
const date=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleDateString();};
async function api(url,options){const r=await fetch(url,{cache:'no-store',...options});const data=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok)throw Error(data.error||'Forum unavailable');return data;}
const empty=(title,description)=>{const n=text('div','forum-empty','');n.append(text('h3','',title),text('p','',description));return n;};
function renderCategories(){
 const root=$('#forum-categories');root.replaceChildren();
 for(const item of [{id:'all',label:'All discussions'},...categories]){
  const count=item.id==='all'?state.topics.length:state.topics.filter(t=>t.category===item.id).length;
  const b=text('button','forum-category'+(item.id===state.filter?' active':''),'');b.type='button';b.append(text('span','',item.label),text('span','',count));
  b.onclick=()=>{state.filter=item.id;listing();};root.append(b);
 }
}
function render(){
 renderCategories();$('#forum-filter-label').textContent=state.filter==='all'?'ALL DISCUSSIONS':name(state.filter).toUpperCase();
 const root=$('#forum-topics');root.replaceChildren();
 const shown=state.topics.filter(t=>(state.filter==='all'||t.category===state.filter)&&
  [t.title,t.author,t.body].join(' ').toLowerCase().includes(state.query));
 if(!shown.length){root.append(empty('NO DISCUSSIONS FOUND','Choose a category or try another search.'));return;}
 for(const topic of shown){
  const b=text('button','forum-topic','');b.type='button';
  const main=text('div','','');main.append(text('small','',name(topic.category).toUpperCase()+' // '+topic.author),text('h4','',topic.title),text('p','',topic.body.slice(0,180)));
  b.append(main,text('small','',date(topic.createdAt)));b.onclick=()=>openTopic(topic.id);root.append(b);
 }
}
function listing(){
 state.topic=null;$('#forum-list-view').hidden=false;$('#forum-thread-view').hidden=true;
 const u=new URL(location.href);u.searchParams.delete('topic');history.replaceState({},'',u);render();
}
async function openTopic(id){
 if(!state.topics.some(t=>t.id===id))return;
 state.topic=id;$('#forum-list-view').hidden=true;$('#forum-thread-view').hidden=false;
 const u=new URL(location.href);u.searchParams.set('topic',id);history.replaceState({},'',u);
 $('#forum-thread').replaceChildren(empty('LOADING…',''));
 try{
  const data=await api('/api/forum?topic='+encodeURIComponent(id));
  if(state.topic!==id)return;
  const t=data.topic,box=text('article','forum-thread','');
  box.append(text('div','category',name(t.category)),text('h2','',t.title),text('div','forum-byline','POSTED BY '+t.author+' · '+date(t.createdAt)),text('p','forum-message',t.body));
  $('#forum-thread').replaceChildren(box);
  const replies=$('#forum-replies');replies.replaceChildren(text('h3','forum-replies-heading','REPLIES ('+data.replies.length+')'));
  for(const reply of data.replies){
   const n=text('article','forum-reply-item','');n.append(text('div','forum-byline',reply.author+' · '+date(reply.createdAt)),text('p','forum-message',reply.body));replies.append(n);
  }
  if(!data.replies.length)replies.append(empty('NO REPLIES YET','The discussion is just getting started.'));
 }catch(e){note(e.message);$('#forum-thread').replaceChildren(empty('DISCUSSION UNAVAILABLE','Please try again.'));}
}
function composer(mode){
 if(!state.posting)return;state.mode=mode;$('#forum-form').reset();$('#forum-form-error').hidden=true;
 $('#forum-topic-inputs').hidden=mode==='reply';$('#forum-form-title').textContent=mode==='reply'?'POST REPLY':'NEW DISCUSSION';
 $('#forum-submit').textContent=mode==='reply'?'POST REPLY':'POST DISCUSSION';
 if(mode==='topic')$('#forum-category').value=state.filter==='eve-guides'?'eve-guides':'general';
 if(window.turnstile&&state.widget!==null)window.turnstile.reset(state.widget);
 $('#forum-dialog').showModal();
}
function initializeTurnstile(){
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
 script.onload=()=>{if(window.turnstile)state.widget=window.turnstile.render('#forum-turnstile',{sitekey:state.siteKey,theme:'dark'});};
 script.onerror=()=>note('Human verification could not load.');document.head.append(script);
}
async function load(){
 try{
  const result=await api('/api/forum');state.topics=Array.isArray(result.topics)?result.topics:[];
  state.posting=Boolean(result.postingEnabled&&result.turnstileSiteKey);state.siteKey=result.turnstileSiteKey;
  $('#forum-new').disabled=!state.posting;$('#forum-reply').disabled=!state.posting;render();
  note(state.posting?'Public discussions. Names are not verified.':'FORUM PREVIEW — Reading enabled. Posting awaits spam protection and moderation.');
  if(state.posting)initializeTurnstile();
  const topic=new URL(location.href).searchParams.get('topic');if(topic)openTopic(topic);
 }catch(e){render();note('Forum service is not online yet. The discussion board is ready for deployment.');}
}
for(const c of categories){const option=document.createElement('option');option.value=c.id;option.textContent=c.label;$('#forum-category').append(option);}
$('#forum-search').oninput=e=>{state.query=e.target.value.toLowerCase().trim();render();};
$('#forum-new').onclick=()=>composer('topic');$('#forum-reply').onclick=()=>composer('reply');$('#forum-back').onclick=listing;
$('#forum-close').onclick=()=>$('#forum-dialog').close();$('#forum-cancel').onclick=()=>$('#forum-dialog').close();
$('#forum-form').onsubmit=async e=>{
 e.preventDefault();if(!state.posting)return;
 const error=$('#forum-form-error');error.hidden=true;
 const token=window.turnstile&&state.widget!==null?window.turnstile.getResponse(state.widget):'';
 if(!token){error.textContent='Complete human verification first.';error.hidden=false;return;}
 const payload={type:state.mode,author:$('#forum-author').value.trim(),body:$('#forum-body').value.trim(),website:$('#forum-website').value,token};
 if(state.mode==='topic'){payload.title=$('#forum-title').value.trim();payload.category=$('#forum-category').value;}
 else payload.topicId=state.topic;
 const button=$('#forum-submit');button.disabled=true;
 try{
  const result=await api('/api/forum',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  $('#forum-dialog').close();const all=await api('/api/forum');state.topics=all.topics||[];
  if(payload.type==='topic')await openTopic(result.id);else await openTopic(payload.topicId);
  note('Message published.');
 }catch(err){error.textContent=err.message;error.hidden=false;}
 finally{button.disabled=false;if(window.turnstile&&state.widget!==null)window.turnstile.reset(state.widget);}
};
load();
})();