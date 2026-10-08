import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {flatten,reconcile} from './source.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/justin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(process.env.MIGRATION_PRIVATE||'../../migration-private');
if(out.startsWith(path.resolve('.')+path.sep))throw Error('Private output must be outside public checkout');
await fs.mkdir(out,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:!process.argv.includes('--login'),executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',proxy:{server:process.env.MIGRATION_PROXY||'http://127.0.0.1:7890'}});
const ctx=await browser.newContext();
try{const cookie=JSON.parse(await fs.readFile(path.join(out,'cookies.json'),'utf8').catch(()=>fs.readFile(path.join(os.homedir(),'.wechat_cookies.json'),'utf8')));await ctx.addCookies(cookie);}catch{}
const page=await ctx.newPage();
try{
 await page.goto('https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN',{waitUntil:'domcontentloaded',timeout:30000});
 let token=new URL(page.url()).searchParams.get('token');
 if(!token&&process.argv.includes('--login')){
  await page.goto('https://mp.weixin.qq.com/cgi-bin/loginpage?t=wxm2-login&lang=zh_CN');
  console.log('等待扫码登录；会话只保存到私有目录。');
  const until=Date.now()+600000;
  while(Date.now()<until&&!token){await page.waitForTimeout(2000);token=new URL(page.url()).searchParams.get('token');}
 }
 if(!token)throw Error('LOGIN_REQUIRED: 请运行 npm run collect -- --login');
 await fs.writeFile(path.join(out,'cookies.json'),JSON.stringify(await ctx.cookies()),{mode:0o600});
 const raw=[];let expected=null;
 for(let begin=0;;begin+=10){
  const u=new URL('https://mp.weixin.qq.com/cgi-bin/appmsgpublish');
  for(const [k,v]of Object.entries({token,lang:'zh_CN',f:'json',ajax:'1',sub:'list',begin,count:10,query:'',type:'101_1_102_103',free_publish_type:'1_102_103',sub_action:'list_ex',search_card:0}))u.searchParams.set(k,v);
  const r=await ctx.request.get(u.href,{headers:{Referer:page.url()},timeout:30000});const d=await r.json();
  if(d.base_resp?.ret||!d.publish_page)throw Error(`Source list unavailable (ret ${d.base_resp?.ret??'unknown'})`);
  const data=JSON.parse(d.publish_page);expected=data.total_count??expected;const batch=data.publish_list||[];raw.push(...batch);
  await fs.writeFile(path.join(out,'inventory.partial.json'),JSON.stringify({complete:false,raw,expected}));
  console.log(`发表记录 ${raw.length}/${expected??'?'}`);
  if(!batch.length||(expected!==null&&raw.length>=Number(expected)))break;
  await page.waitForTimeout(1500);
 }
 if(expected===null||raw.length!==Number(expected))throw Error('Incomplete publication inventory');
 const articles=reconcile(flatten(raw));
 await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify({complete:true,fetched_at:new Date().toISOString(),expected,articles,raw},null,2));
 console.log(`完成：${articles.length} 篇；尚需逐篇页面核验。`);
}finally{await browser.close();}
