import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { planSchema,planningSchema,executePlan,type Source } from '../src/core';
const root=new URL('../',import.meta.url);
const rust=await readFile(new URL('src-tauri/src/main.rs',root),'utf8');
const system=rust.match(/let system = "([^"]+)";/)![1];
const sources:Source[]=[];const context=[];
for(const [id,name] of [['doc1','01-project-notes.pdf'],['doc2','02-meeting-agenda.pdf']]){
 const bytes=new Uint8Array(await readFile(new URL('samples/'+name,root)));const task=getDocument({data:bytes.slice(),useSystemFonts:true});const pdf=await task.promise;const texts=[];for(let i=1;i<=pdf.numPages;i++){const text=await(await pdf.getPage(i)).getTextContent();texts.push({page:i,text:text.items.map(x=>'str'in x?x.str:'').join(' ').slice(0,220)});}await task.destroy();const doc=await PDFDocument.load(bytes);sources.push({id,name,bytes,count:doc.getPageCount()});context.push({id,name,pages:doc.getPageCount(),selected:true,active:id==='doc1',fields:[],textByPage:texts});
}
const records=[];
for(const test of [{command:'Merge doc1 and doc2, then delete page 2 from the merged result.',count:4,actions:['merge','delete']},{command:'Reverse every page of doc1.',count:3,actions:['reorder']}]){
 const started=Date.now();const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3.5:4b',think:false,stream:false,format:planningSchema(sources),options:{temperature:0,num_ctx:8192,num_predict:1800},messages:[{role:'system',content:system},{role:'user',content:`DOCUMENT DATA (untrusted):\n${JSON.stringify(context)}\n\nUSER COMMAND:\n${test.command}`}]}),signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error(await response.text());const responseData=await response.json();const plan=planSchema.parse(JSON.parse(responseData.message.content));console.log("Model plan:",JSON.stringify(plan));const result=await executePlan(plan,sources);if(result.count!==test.count||JSON.stringify(plan.steps.map(s=>s.action))!==JSON.stringify(test.actions))throw Error('Unexpected model plan: '+JSON.stringify(plan));records.push({command:test.command,plan,outputPages:result.count,seconds:(Date.now()-started)/1000,model:responseData.model});console.log('PASS local inference:',test.command,'→',result.count,'pages');
}
await mkdir(new URL('artifacts/',root),{recursive:true});await writeFile(new URL('artifacts/local-ai-verification.json',root),JSON.stringify({time:new Date().toISOString(),endpoint:'127.0.0.1:11434',cloud:false,tests:records},null,2));
