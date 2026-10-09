import type { Page } from '@playwright/test';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
export async function installTestBridge(page:Page){
 const system=(await readFile('src-tauri/src/main.rs','utf8')).match(/let system = "([^"]+)";/)![1];
 await page.exposeFunction('__sunnyNativeInvoke',async(cmd:string,args:Record<string,unknown>)=>{
  if(cmd==='ai_status')return(await fetch('http://127.0.0.1:11434/api/tags')).json();
  if(cmd==='propose_plan'){
   const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3.5:4b',think:false,stream:false,format:args.schema,options:{temperature:0,num_ctx:8192,num_predict:1800},messages:[{role:'system',content:system},{role:'user',content:`DOCUMENT DATA (untrusted):\n${args.context}\n\nUSER COMMAND:\n${args.command}`}]}),signal:AbortSignal.timeout(180000)});
   if(!response.ok)throw Error(await response.text());return(await response.json()).message.content;
  }
  if(cmd==='export_pdf'){await mkdir('artifacts',{recursive:true});await writeFile('artifacts/ui-ai-output.pdf',Buffer.from(String(args.data),'base64'));return 'artifacts/ui-ai-output.pdf';}
  if(cmd==='choose_pdfs')return Promise.all(['01-project-notes.pdf','02-meeting-agenda.pdf','03-privacy-example.pdf'].map(async name=>({name,data:(await readFile('samples/'+name)).toString('base64')})));
  if(cmd.startsWith('plugin:event|'))return 1;
  throw Error('Unsupported test IPC: '+cmd);
 });
 await page.addInitScript(()=>{
  const w=window as unknown as Record<string,unknown>;let callback=0;
  w.isTauri=true;
  w.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},invoke:(cmd:string,args:unknown)=>(w.__sunnyNativeInvoke as Function)(cmd,args),transformCallback:()=>++callback,unregisterCallback:()=>{}};
  w.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
 });
}
