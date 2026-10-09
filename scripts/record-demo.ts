import { webkit } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installTestBridge } from '../e2e/native-bridge';
await mkdir('artifacts',{recursive:true});
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'artifacts/demo-capture',size:{width:1440,height:1000}}});
const page=await context.newPage();await installTestBridge(page);
const start=Date.now();
async function until(seconds:number){const remaining=seconds*1000-(Date.now()-start);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}
async function caption(text:string){await page.evaluate(text=>{let el=document.getElementById('demo-caption');if(!el){el=document.createElement('div');el.id='demo-caption';el.style.cssText='position:fixed;bottom:15px;left:230px;right:345px;padding:13px 20px;border-radius:12px;background:#33392ff2;color:#fff9df;font:13px -apple-system,BlinkMacSystemFont,sans-serif;z-index:10000;box-shadow:0 3px 15px #0002;text-align:center;pointer-events:none';document.body.append(el);}el.textContent=text;},text);}
try{
 await page.goto('http://127.0.0.1:1421');
 await caption('SunnyDrop: a private PDF workspace. Local AI is real; native dialog calls are simulated in this WebKit demo.');
 await until(5);await page.getByRole('button',{name:'Add PDFs',exact:true}).click();await page.locator('.file-card').nth(2).waitFor();
 await caption('Add PDFs. Choose a sun ray to merge, split, reorder, fill, compress, or delete pages.');
 await until(12);await page.locator('.file-card').filter({hasText:'03-privacy-example.pdf'}).click();await page.getByRole('button',{name:/Privacy check/}).click();await page.locator('.privacy').scrollIntoViewIfNeeded();
 await caption('Review potential emails, phone numbers, and account numbers. Exclude whole pages; this is not secure redaction.');
 await until(23);await page.locator('main').evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));
 await page.getByRole('textbox',{name:'Tell local AI what to do'}).fill('Merge the selected PDFs, then delete page 2 from the merged result.');
 await caption('Ask naturally: merge the selected PDFs, then delete page 2. Qwen3 runs locally through Ollama.');
 await until(27);await page.getByRole('button',{name:'Ask local AI',exact:true}).click();await page.locator('.review').waitFor({timeout:60000});
 await caption('Review the validated multi-step plan and output thumbnails. Nothing is exported without approval.');
 await until(42);await page.getByRole('button',{name:'Approve changes'}).click();await page.locator('.result').scrollIntoViewIfNeeded();
 await caption('Approve the changes. Preview the new PDF. Original files remain untouched.');
 await until(50);await page.getByRole('button',{name:'Export PDF',exact:true}).click();
 await caption('Export a new local copy. Merge, forms, privacy checks, and real AI planning passed with Wi-Fi switched off.');
 await until(57);await caption('SunnyDrop — less paperwork, more sunshine. Built with Tauri, React, pdf-lib, PDF.js, Ollama, and Qwen3.');
 await until(60);await page.screenshot({path:'artifacts/demo-final.png'});
 const video=page.video()!;await context.close();await video.saveAs('artifacts/SunnyDrop-demo.webm');
 console.log('Saved artifacts/SunnyDrop-demo.webm');
}finally{await browser.close();}
