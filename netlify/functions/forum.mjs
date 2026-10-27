/**
 * The Unvanquished two-category public forum.
 * Production data persists across deploys; preview data is isolated to its deploy.
 * Public reads. Writing is off unless TURNSTILE and FORUM_POSTING_ENABLED are configured.
 */
import { getStore, getDeployStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const CATEGORIES = new Set(['general', 'eve-guides']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const postingEnabled = () => process.env.FORUM_POSTING_ENABLED === 'true' &&
  Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
const json = (obj, status=200) => new Response(JSON.stringify(obj), {
  status, headers:{'content-type':'application/json; charset=utf-8',
                   'cache-control':'no-store','x-content-type-options':'nosniff'}
});
const fail = (message,status=400)=>json({error:message},status);
const clean = v => typeof v==='string' ? v.trim() : '';
function store() {
  return process.env.CONTEXT === 'production'
    ? getStore({name:'community-forum-v1',consistency:'strong'})
    : getDeployStore({name:'community-forum-preview-v1',consistency:'strong'});
}
async function listObjects(blobs, prefix, max) {
  const listing = await blobs.list({prefix});
  if (listing.blobs.length > max) throw Error('Forum capacity reached; archive needed.');
  const records = await Promise.all(listing.blobs.map(entry=>
    blobs.get(entry.key,{type:'json',consistency:'strong'})));
  return records.filter(Boolean);
}
function goodText(s,min,max) {
  return s.length>=min && s.length<=max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s);
}
function goodName(s) {
  return goodText(s,2,32) && /^[\p{L}\p{N} ._'\-]+$/u.test(s);
}
async function verifyTurnstile(token,request) {
  if (!token || token.length>2048) return false;
  try {
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),
      signal:AbortSignal.timeout(8000)
    });
    if(!r.ok)return false;
    const result=await r.json();
    return result.success===true && result.hostname===new URL(request.url).hostname;
  }catch{return false;}
}
export default async function handler(request) {
  if (!['GET','POST'].includes(request.method)) return fail('Method not allowed.',405);
  let blobs;
  try { blobs=store(); } catch { return fail('Forum storage unavailable.',503); }
  try {
    const uri=new URL(request.url);
    if(request.method==='GET'){
      const topicId=uri.searchParams.get('topic');
      if(topicId){
        if(!UUID.test(topicId))return fail('Invalid topic ID.');
        const topic=await blobs.get('topic/'+topicId,{type:'json',consistency:'strong'});
        if(!topic)return fail('Discussion not found.',404);
        const replies=(await listObjects(blobs,'reply/'+topicId+'/',250))
          .filter(p=>p.kind==='reply' && p.topicId===topicId)
          .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
        return json({topic,replies});
      }
      const topics=(await listObjects(blobs,'topic/',400))
        .filter(p=>p.kind==='topic' && UUID.test(p.id) && CATEGORIES.has(p.category))
        .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return json({topics,postingEnabled:postingEnabled(),
        turnstileSiteKey:postingEnabled()?process.env.TURNSTILE_SITE_KEY:null});
    }
    if(!postingEnabled())return fail('Posting is not enabled yet.',503);
    const origin=request.headers.get('origin');
    if(origin && origin!==uri.origin)return fail('Cross-origin posting is not allowed.',403);
    if(Number(request.headers.get('content-length')||0)>15000)return fail('Message too long.',413);
    const raw=await request.text();
    if(raw.length>15000)return fail('Message too long.',413);
    let payload;
    try {payload=JSON.parse(raw);}catch{return fail('Invalid JSON.');}
    if(!payload || typeof payload!=='object' || Array.isArray(payload))return fail('Invalid post.');
    if(payload.website)return fail('Submission rejected.');
    const type=clean(payload.type), author=clean(payload.author), body=clean(payload.body);
    if(!goodName(author))return fail('Name must be 2–32 letters, numbers or basic punctuation.');
    if(!goodText(body,10,3000))return fail('Message must be 10–3000 characters.');
    if((body.match(/(?:https?:\/\/|www\.)/gi)||[]).length>2)return fail('Maximum two links.');
    if(!['topic','reply'].includes(type))return fail('Unknown post type.');
    let parent=null;
    if(type==='topic'){
      if(!goodText(clean(payload.title),6,120)||!CATEGORIES.has(clean(payload.category)))
        return fail('Enter a title of 6–120 characters and a valid category.');
    }else{
      const topicId=clean(payload.topicId);
      if(!UUID.test(topicId))return fail('Invalid discussion ID.');
      parent=await blobs.get('topic/'+topicId,{type:'json',consistency:'strong'});
      if(!parent)return fail('Discussion not found.',404);
    }
    if(!await verifyTurnstile(clean(payload.token),request))
      return fail('Human verification failed or expired.',403);
    const id=randomUUID(),createdAt=new Date().toISOString();
    if(type==='topic'){
      const entry={kind:'topic',id,title:clean(payload.title),
        category:clean(payload.category),author,body,createdAt};
      const result=await blobs.setJSON('topic/'+id,entry,{onlyIfNew:true});
      if(!result.modified)return fail('Could not save discussion.',503);
      return json({id},201);
    }
    const entry={kind:'reply',id,topicId:parent.id,author,body,createdAt};
    const result=await blobs.setJSON('reply/'+parent.id+'/'+id,entry,{onlyIfNew:true});
    if(!result.modified)return fail('Could not save reply.',503);
    return json({id,topicId:parent.id},201);
  }catch(e){
    console.error('Forum API error:',e?.message||'Unknown');
    return fail('Forum service temporarily unavailable.',503);
  }
}
export const config={path:'/api/forum',
  rateLimit:{windowLimit:100,windowSize:60,aggregateBy:['ip','domain']}};
