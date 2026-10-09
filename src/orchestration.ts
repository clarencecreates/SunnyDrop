import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {type Source,type Plan,executePlan} from './core';
import type {FormField,Preview} from './pdf';
export const toolRegistry={merge:'Combine PDFs in the specified order',split:'Extract selected pages into one PDF',reorder:'Reorder every page',delete:'Remove selected pages',fill:'Fill existing interactive fields',compress:'Lossless repack; does not downsample images'} as const;
const ids=z.array(z.string().min(1)).min(1).max(12),pages=z.array(z.number().int().positive()).min(1).max(1500);
const steps=z.discriminatedUnion('tool',[
 z.object({tool:z.literal('merge'),inputs:ids.min(2),arguments:z.object({}).strict()}).strict(),
 ...(['split','reorder','delete'] as const).map(tool=>z.object({tool:z.literal(tool),inputs:ids.length(1),arguments:z.object({pages}).strict()}).strict()),
 z.object({tool:z.literal('fill'),inputs:ids.length(1),arguments:z.object({fields:z.record(z.union([z.string().max(2000),z.boolean()]))}).strict()}).strict(),
 z.object({tool:z.literal('compress'),inputs:ids.length(1),arguments:z.object({}).strict()}).strict(),
]);
export const executionSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('plan'),steps:z.array(steps).min(1).max(8)}).strict(),
 z.object({status:z.literal('unsupported'),operation:z.string().max(120)}).strict(),
 z.object({status:z.literal('answer')}).strict(),
 z.object({status:z.literal('clarify'),question:z.string().min(1).max(500)}).strict(),
]);
export type Document=Source&{fields:FormField[];previews:Preview[]};
export function documentManifest(docs:Document[]){return docs.map((d,i)=>({id:d.id,filename:d.name,pageCount:d.count,active:i===0,fields:d.fields.map(f=>({name:f.name,kind:f.kind,readOnly:f.readOnly,options:f.options})),textByPage:d.previews.map((p,i)=>({page:i+1,text:p.text.slice(0,Math.max(50,Math.floor(14000/(docs.length*d.count))))}))}));}
export function executionJsonSchema(docs:Source[]){const schema=zodToJsonSchema(executionSchema,{$refStrategy:'none'});function walk(v:any){if(!v||typeof v!=='object')return;if(v.properties?.inputs?.items)v.properties.inputs.items.enum=[...docs.map(d=>d.id),'result'];Object.values(v).forEach(walk);}walk(schema);return schema;}
export function validateExecution(raw:unknown,docs:Document[]):{plan:Plan;descriptions:string[];outputPages:number}{
 const envelope=executionSchema.parse(raw);if(envelope.status==='unsupported')throw Error(unsupportedRequest(envelope.operation)??(/^[-a-z ]{1,80}$/i.test(envelope.operation)?`The ${envelope.operation} step is not supported in chat. You can use Merge, Split, Reorder, Delete pages, Fill interactive fields, or lossless Compress. No changes have been made.`:'That workflow includes an unsupported PDF operation. Available actions are Merge, Split, Reorder, Delete pages, Fill interactive fields, and lossless Compress. No changes have been made.'));if(envelope.status==='clarify')throw Error(friendlyChatText(envelope.question,docs));if(envelope.status==='answer')throw Error('This request needs a document answer, not an execution plan.');
 const states=new Map(docs.map(d=>[d.id,{count:d.count,name:d.name,fields:d.fields}]));const plan:Plan={summary:'Requested PDF changes',steps:[]};const descriptions:string[]=[];
 for(const [i,step] of envelope.steps.entries()){
  if(!(step.tool in toolRegistry))throw Error(`Step ${i+1} is not supported.`);
  const inputs=step.inputs.map(id=>{const state=states.get(id);if(!state)throw Error(`Step ${i+1} refers to an unavailable document. Please specify its filename.`);return state;});if(new Set(step.inputs).size!==step.inputs.length)throw Error(`Step ${i+1} repeats a document.`);
  let count=inputs[0].count,fields=inputs[0].fields;const names=inputs.map(d=>d.name).join(', ');
  if(step.tool==='merge'){count=inputs.reduce((n,d)=>n+d.count,0);fields=[];plan.steps.push({action:'merge',inputs:step.inputs});descriptions.push(`Combine ${names}, in this order.`);}
  else if('pages'in step.arguments){const selection=step.arguments.pages;if(new Set(selection).size!==selection.length||selection.some(p=>p>count))throw Error(`Step ${i+1} selects pages outside the document or repeats a page.`);if(step.tool==='reorder'&&selection.length!==count)throw Error(`Step ${i+1} must include every page once.`);count=step.tool==='delete'?count-selection.length:selection.length;if(!count)throw Error(`Step ${i+1} would remove every page.`);fields=[];plan.steps.push({action:step.tool as 'delete'|'split'|'reorder',input:step.inputs[0],pages:selection});descriptions.push(`${step.tool==='delete'?'Remove':step.tool==='split'?'Extract':'Reorder'} pages ${selection.join(', ')} from ${names}.`);}
  else if(step.tool==='fill'){const values=step.arguments.fields;if(!Object.keys(values).length)throw Error(`Step ${i+1} has no fields to fill.`);for(const [name,value]of Object.entries(values)){const field=fields.find(f=>f.name===name);if(!field||field.readOnly||field.kind==='unsupported'||(field.kind==='checkbox'?typeof value!=='boolean':typeof value!=='string')||(field.options&&typeof value==='string'&&!field.options.includes(value)))throw Error(`Step ${i+1} cannot fill the requested field. Choose an existing editable field.`);}plan.steps.push({action:'fill',input:step.inputs[0],fields:values});descriptions.push(`Fill ${Object.keys(values).length} interactive fields in ${names}.`);}
  else {plan.steps.push({action:'compress',input:step.inputs[0]});descriptions.push(`Losslessly compress ${names}; image quality stays unchanged.`);}
  states.set('result',{count,name:'the previous step’s output',fields});
 }
 return{plan,descriptions,outputPages:states.get('result')!.count};
}
export function legacyExecution(plan:Plan){return{status:'plan',steps:plan.steps.map(s=>({tool:s.action,inputs:s.action==='merge'?s.inputs:[s.input],arguments:'pages'in s?{pages:s.pages}:'fields'in s?{fields:s.fields}:{}}))};}
export async function executeApproved(plan:Plan,docs:Document[]){validateExecution(legacyExecution(plan),docs);return executePlan(plan,docs);}
export function unsupportedRequest(request:string){const match=request.match(/\b(redact(?:ion)?|translate|encrypt|decrypt|ocr|convert|watermark|rotate|sign|digitally sign)\b/i);if(!match)return null;return `The ${match[0]} step is not supported in chat. ${/^redact/i.test(match[0])?'Secure redaction must remove recoverable content; SunnyDrop does not implement it. You can instead review and delete entire sensitive pages.':'You can use Merge, Split, Reorder, Delete pages, Fill interactive fields, or lossless Compress.'} No changes have been made.`;}
export function friendlyChatText(text:string,docs:Source[]){let visible=text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi,'');for(const doc of docs)visible=visible.split(doc.id).join(doc.name);if(/^\s*[\[{]/.test(visible)||/\b(?:ZodError|reqwest|stack trace|invalid structured output grammar)\b/i.test(visible))return 'I couldn’t produce a valid response. Please try a more specific request. No files were changed.';return visible;}

export async function proposeWorkflow(request:string,docs:Document[],history:{role:string;text:string}[],call:(args:Record<string,unknown>)=>Promise<string>){
 // Capability guard prevents a model from silently omitting explicitly unsupported steps.
 const unsupported=request.match(/\b(redact(?:ion)?|translate|encrypt|decrypt|ocr|convert|watermark|rotate|sign|digitally sign)\b/i);
 if(unsupported)return {status:'unsupported' as const,operation:unsupported[0]};
 const base={command:request,manifest:JSON.stringify(documentManifest(docs)),schema:executionJsonSchema(docs),history:history.slice(-6)};
 let correction:unknown=null;
 for(let attempt=0;attempt<2;attempt++){
  const raw=await call({...base,correction});
  try{
   const parsed=executionSchema.parse(JSON.parse(raw));
   if(parsed.status!=='plan')return parsed;
   return {status:'validated' as const,checked:validateExecution(parsed,docs)};
  }catch(error){
   correction={previousOutput:raw.slice(0,12000),validationError:error instanceof z.ZodError?error.issues.map(i=>({path:i.path,message:i.message})):error instanceof Error?error.message:'Invalid JSON'};
  }
 }
 throw Error('I couldn’t prepare a reliable plan for that request. Please clarify which files and changes you want. No files were changed.');
}
