import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {planSchema,type Source,type Plan} from './core';
import type {Preview,FormField} from './pdf';
const citations=z.array(z.object({document:z.string(),page:z.number().int().positive()}).strict()).max(30);
const answerSchema=z.object({kind:z.literal('answer'),answer:z.string().min(1).max(10000),citations}).strict();
const responseSchema=z.discriminatedUnion('kind',[answerSchema,z.object({kind:z.literal('plan'),answer:z.string().max(10000),citations,plan:planSchema}).strict()]);
export function chatSchema(docs:Source[]){const schema=zodToJsonSchema(responseSchema,{$refStrategy:"none"});function walk(v:unknown){if(!v||typeof v!=='object')return;const n=v as Record<string,any>;if(n.properties?.input)n.properties.input.enum=[...docs.map(d=>d.id),'result'];if(n.properties?.inputs?.items)n.properties.inputs.items.enum=[...docs.map(d=>d.id),'result'];if(n.properties?.document)n.properties.document.enum=docs.map(d=>d.id);Object.values(n).forEach(walk);}walk(schema);return schema;}
export function chatContext(docs:(Source&{previews:Preview[];fields:FormField[]})[],query:string){
 const terms=[...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])];
 let budget=22000;
 return docs.map((d,di)=>{const ranked=d.previews.map((p,i)=>({page:i+1,text:p.text,score:terms.reduce((sum,t)=>sum+(p.text.toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);const selected=ranked.slice(0,Math.max(2,Math.floor(12/docs.length)));for(const i of [0,Math.floor(d.count/2),d.count-1])if(!selected.some(p=>p.page===i+1))selected.push(ranked.find(p=>p.page===i+1)!);return{id:d.id,filename:d.name,pages:d.count,active:di===0,fields:d.fields.map(f=>({name:f.name,kind:f.kind,options:f.options,readOnly:f.readOnly})),textByPage:selected.sort((a,b)=>a.page-b.page).map(p=>{const text=p.text.slice(0,Math.min(2500,Math.max(0,budget)));budget-=text.length;return{page:p.page,text};})};});
}
export function parseChat(raw:string,context:ReturnType<typeof chatContext>){
 const json=JSON.parse(raw);
 if(json.kind==='answer'&&json.bullets!==undefined){const bullets=z.array(z.string().min(1).max(500)).min(3).max(5).parse(json.bullets);json.answer=json.answer+"\n\n"+bullets.map(b=>"- "+b.replace(/\n/g," ")).join("\n");}
 // Answers cannot execute edits. Ignore a stray plan from older/mixed model outputs.
 const response=responseSchema.parse(json.kind==='answer'?{kind:json.kind,answer:json.answer,citations:json.citations}:json);
 for(const c of response.citations)if(!context.some(d=>d.id===c.document&&d.textByPage.some(p=>p.page===c.page&&p.text.trim())))throw Error('The model cited an unavailable page. Please try a more specific question.');
 if(response.kind==='answer'&&!response.answer.trim())throw Error('The local model returned an empty answer.');return response;
}

export function isSummary(query:string){return /summari[sz]|overview|key points/i.test(query);}
export function summaryChatSchema(docs:Source[]){const schema=zodToJsonSchema(z.object({kind:z.literal('answer'),answer:z.string().min(1).max(1500),bullets:z.array(z.string().min(1).max(500)).min(3).max(5),citations}).strict(),{$refStrategy:'none'});(schema as any).properties.citations.items.properties.document.enum=docs.map(d=>d.id);return schema;}
export function isEditRequest(query:string){return /\b(remove|delete|merge|combine|split|extract|reorder|reverse|compress|fill)\b/i.test(query)&&!/^\s*(how|what|why|can (?:sunnydrop|you) do)\b/i.test(query);}
export function directPlan(query:string,docs:Source[]):Plan|null{
 if(!docs.length)return null;
 const q=query.trim().replace(/[?.!]+$/,'').toLowerCase();
 const parity=q.match(/^(?:(?:can|could|would) you\s+|please\s+)?(?:remove|delete) (?:all |the |all the )?(odd|even)(?: numbered|-numbered)? pages(?: (?:in|from|of) (?:the |this |my )?(?:file|pdf|document))?$/);
 if(parity){const pages=Array.from({length:docs[0].count},(_,i)=>i+1).filter(p=>p%2===(parity[1]==='odd'?1:0));if(!pages.length)throw Error('There are no matching pages to remove.');return{summary:`Remove ${parity[1]}-numbered pages`,steps:[{action:'delete',input:docs[0].id,pages}]};}
 return null;
}
export function editContext(docs:(Source&{fields:FormField[]})[]){return docs.map((d,i)=>({id:d.id,pages:d.count,active:i===0,fields:d.fields.map(f=>({name:f.name,kind:f.kind,options:f.options,readOnly:f.readOnly}))}));}
// Decode only visible answer strings; partial JSON is never an executable plan.
export function partialAnswer(raw:string){
 if(!/"kind"\s*:\s*"answer"/.test(raw))return '';
 function stringAt(start:number){let value='';for(let i=start;i<raw.length;i++){const c=raw[i];if(c==='"')return value;if(c==='\\'){const next=raw[++i];if(!next)break;if(next==='u'){const hex=raw.slice(i+1,i+5);if(!/^[\da-f]{4}$/i.test(hex))break;value+=String.fromCharCode(parseInt(hex,16));i+=4;}else value+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'} as Record<string,string>)[next]??next;}else value+=c;}return value;}
 const answer=/"answer"\s*:\s*"/.exec(raw);let text=answer?stringAt(answer.index+answer[0].length):'';
 const bullets=/"bullets"\s*:\s*\[/.exec(raw);if(bullets){const rest=raw.slice(bullets.index+bullets[0].length);const starts=[...rest.matchAll(/(?:^|,)\s*"/g)];text+='\n\n'+starts.map(m=>'- '+stringAt(bullets.index+bullets[0].length+m.index!+m[0].length)).join('\n');}return text;
}
