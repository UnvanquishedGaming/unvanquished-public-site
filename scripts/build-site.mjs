import { readdir, rm, mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
const root=process.cwd(), output=join(root,'dist');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const item of await readdir(root,{withFileTypes:true})){
 if(item.isDirectory()&&['assets','content'].includes(item.name))await cp(join(root,item.name),join(output,item.name),{recursive:true});
 else if(item.isFile()&&['.html','.js','.css'].includes(extname(item.name))){
  if(extname(item.name)==='.html'&&item.name!=='forums.html'){
   const old=await readFile(join(root,item.name),'utf8'), link='<a href="/forums">Forums</a>';
   const next=old.includes('href="/forums"')?old:old.replace(/(<a\s+class="nav-cta"\s+href="enlist\.html">)/,link+'$1');
   await writeFile(join(output,item.name),next);
  }else await copyFile(join(root,item.name),join(output,item.name));
 }
}
const present=new Set(await readdir(output));
for(const req of ['index.html','calendar.html','news.html','killboard.html','app.js','killboard-feed.js','eve-official-news.js','styles.css','forums.html','forums.css','forums.js'])
 if(!present.has(req))throw Error('Missing required file: '+req);
console.log('Website and forums built into dist/');
