'use strict';
(()=>{
const $=s=>document.querySelector(s);
let key='',list=[],current=null;
const status=s=>$('#mod-status').textContent=s;
const el=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value??'');return n;};
async function get(url){const r=await fetch(url,{cache:'no-store'});const json=await r.json();if(!r.ok)throw Error(json.error||'Unable to read discussions');return json;}
async function remove(action,topicId,replyId){
 const label=action==='delete-topic'?'ENTIRE discussion and ALL its replies':'selected reply';
 if(!confirm('Permanently delete the '+label+'? This cannot be undone.'))return;
 const r=await fetch('/api/forum-admin',{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer '+key},
 body:JSON.stringify({action,topicId,replyId})});
 const data=await r.json().catch(()=>({error:'Invalid server response'}));
 if(!r.ok)throw Error(data.error||'Unable to remove content');
 status('Content deleted successfully.');await refresh();
 if(action==='delete-reply')await thread(topicId);
}
function record(topic,detail){
 const n=el('article','');n.className='mod-record';
 n.append(el(detail?'h2':'h3',topic.title||'Untitled'),el('small',topic.category+' · '+topic.author+' · '+topic.createdAt));
 if(detail)n.append(el('p',topic.body));
 const actions=el('div','');actions.className='mod-actions';
 if(!detail){const view=el('button','VIEW REPLIES');view.onclick=()=>thread(topic.id);actions.append(view);}
 const del=el('button','DELETE DISCUSSION');del.className='mod-danger';
 del.onclick=()=>remove('delete-topic',topic.id).catch(e=>status(e.message));
 actions.append(del);n.append(actions);return n;
}
async function refresh(){
 const data=await get('/api/forum');list=data.topics||[];current=null;
 $('#mod-thread').hidden=true;$('#mod-topics').hidden=false;
 const root=$('#mod-topics');root.replaceChildren();
 if(!list.length)root.append(el('p','No discussions to moderate yet.'));
 for(const t of list)root.append(record(t,false));
 status(list.length+' discussion(s) loaded.');
}
async function thread(id){
 current=id;const d=await get('/api/forum?topic='+encodeURIComponent(id));
 $('#mod-topics').hidden=true;$('#mod-thread').hidden=false;
 $('#mod-topic-detail').replaceChildren(record(d.topic,true));
 const root=$('#mod-replies');root.replaceChildren(el('h2','Replies ('+d.replies.length+')'));
 for(const reply of d.replies){
  const n=el('article','');n.className='mod-record';
  n.append(el('small',reply.author+' · '+reply.createdAt),el('p',reply.body));
  const btn=el('button','DELETE REPLY');btn.className='mod-danger';
  btn.onclick=()=>remove('delete-reply',id,reply.id).catch(e=>status(e.message));
  n.append(btn);root.append(n);
 }
}
$('#mod-login').onsubmit=async e=>{
 e.preventDefault();key=$('#mod-key').value.trim();$('#mod-key').value='';
 if(key.length<32){status('Moderator key must be at least 32 characters.');key='';return;}
 try{
  const response=await fetch('/api/forum-admin',{method:'POST',
   headers:{'content-type':'application/json',authorization:'Bearer '+key},
   body:JSON.stringify({action:'verify'})});
  const data=await response.json().catch(()=>({error:'Unable to verify moderator key.'}));
  if(!response.ok||!data.verified)throw Error(data.error||'Moderator key not accepted.');
  $('#mod-login').hidden=true;$('#mod-controls').hidden=false;
  await refresh();status('Moderator access verified. You can review and remove discussions.');
 }catch(e){status(e.message);$('#mod-login').hidden=false;$('#mod-controls').hidden=true;key='';}
};
$('#mod-lock').onclick=()=>{key='';current=null;$('#mod-controls').hidden=true;$('#mod-login').hidden=false;status('Moderation locked.');};
$('#mod-backup').onclick=async()=>{
 const btn=$('#mod-backup');btn.disabled=true;status('Preparing backup...');
 try{
  const r=await fetch('/api/forum-admin',{method:'POST',headers:{
   'content-type':'application/json',authorization:'Bearer '+key},
   body:JSON.stringify({action:'export'}),cache:'no-store'});
  const body=await r.json();
  if(!r.ok)throw Error(body.error||'Backup unavailable');
  if(body.schema!=='unvanquished-forum-v1'||!Array.isArray(body.topics)||!Array.isArray(body.replies))throw Error('Unexpected backup data.');
  const blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  link.download='unvanquished-forums-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);link.click();link.remove();
  URL.revokeObjectURL(url);
  status('Backup prepared: '+body.topics.length+' topics and '+body.replies.length+' replies. Store the file securely.');
 }catch(err){status(err.message);}
 finally{btn.disabled=false;}
};
$('#mod-refresh').onclick=()=>refresh().catch(e=>status(e.message));
$('#mod-back').onclick=()=>{current=null;$('#mod-thread').hidden=true;$('#mod-topics').hidden=false;};
})();
