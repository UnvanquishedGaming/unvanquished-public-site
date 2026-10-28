/**
 * Owner-only moderation actions for The Unvanquished forum.
 * All credentials are server-side environment variables; no public admin API reads.
 */
import {getStore,getDeployStore} from '@netlify/blobs';
import {createHash,timingSafeEqual} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
const fail=(message,status=400)=>response({error:message},status);
function authorized(request){
 const expected=process.env.FORUM_ADMIN_TOKEN;
 if(typeof expected!=='string'||expected.length<32) return false;
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Bearer ')||header.length>1024)return false;
 const supplied=header.slice(7);
 const hash=v=>createHash('sha256').update(v,'utf8').digest();
 return timingSafeEqual(hash(supplied),hash(expected));
}
function store(){
 return process.env.CONTEXT==='production'
 ?getStore({name:'community-forum-v1',consistency:'strong'})
 :getDeployStore({name:'community-forum-preview-v1',consistency:'strong'});
}
export default async function handler(request){
 if(request.method!=='POST')return fail('Method not allowed.',405);
 if(!process.env.FORUM_ADMIN_TOKEN || process.env.FORUM_ADMIN_TOKEN.length<32)
   return fail('Moderation has not been configured.',503);
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return fail('Origin not permitted.',403);
 const fetchSite=request.headers.get('sec-fetch-site');
 if(fetchSite && !['same-origin','none'].includes(fetchSite))
   return fail('Cross-site request blocked.',403);
 if(!authorized(request))return fail('Incorrect moderator key.',401);
 if(Number(request.headers.get('content-length')||0)>1024)return fail('Invalid request.',413);
 let payload;
 try{
   const raw=await request.text();
   if(raw.length>1024)return fail('Invalid request.',413);
   payload=JSON.parse(raw);
 }catch{return fail('Invalid request body.');}
 if(!payload || typeof payload!=='object')return fail('Invalid request body.');
 const {action,topicId,replyId}=payload;
 if(action==='verify')return response({ok:true,verified:true});
 if(!UUID.test(topicId||''))return fail('Invalid discussion ID.');
 if(!['delete-topic','delete-reply'].includes(action))return fail('Unknown action.');
 if(action==='delete-reply'&&!UUID.test(replyId||''))return fail('Invalid reply ID.');
 try{
   const blobs=store();
   const topic=await blobs.get('topic/'+topicId,{type:'json',consistency:'strong'});
   if(!topic)return fail('Discussion not found.',404);
   if(action==='delete-reply'){
     const key='reply/'+topicId+'/'+replyId;
     if(!await blobs.get(key,{type:'json',consistency:'strong'}))return fail('Reply not found.',404);
     await blobs.delete(key);
     return response({ok:true,deleted:'reply'});
   }
   const keys=(await blobs.list({prefix:'reply/'+topicId+'/'})).blobs.map(x=>x.key);
   if(keys.length>1000)return fail('Too many replies for automatic deletion; contact site administrator.',409);
   for(const key of keys)await blobs.delete(key);
   await blobs.delete('topic/'+topicId);
   return response({ok:true,deleted:'topic',repliesRemoved:keys.length});
 }catch(e){
   console.error('Forum moderation failure',e?.message||'Unknown');
   return fail('Moderation service temporarily unavailable.',503);
 }
}
export const config={path:'/api/forum-admin',
 rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};
