// No dependencies. Copies the current static site to Netlify's publish directory.
// Source serverless functions remain outside dist and are bundled by Netlify.
import { readdir, rm, mkdir, copyFile, cp } from 'node:fs/promises';
import { join, extname } from 'node:path';
const root = process.cwd();
const output = join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isDirectory() && ['assets','content'].includes(entry.name)) {
    await cp(join(root, entry.name), join(output, entry.name), { recursive: true });
  } else if (entry.isFile() && ['.html','.js','.css'].includes(extname(entry.name))) {
    await copyFile(join(root, entry.name), join(output, entry.name));
  }
}
for (const required of ['index.html','calendar.html','news.html','killboard.html','app.js','killboard-feed.js','eve-official-news.js','styles.css']) {
  if (!(await readdir(output)).includes(required)) throw new Error(`Missing required site file: ${required}`);
}
console.log('Static website copied to dist/; Netlify Functions remain in netlify/functions/');
