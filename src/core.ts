import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
export type Source = { id: string; name: string; bytes: Uint8Array; count: number };
const pageList = z.array(z.number().int().positive()).min(1).max(1500);
const reference = z.string().min(1).max(100);
const actions = z.discriminatedUnion('action', [
  z.object({action:z.literal('merge'),inputs:z.array(reference).min(2).max(12)}).strict(),
  z.object({action:z.literal('split'),input:reference,pages:pageList}).strict(),
  z.object({action:z.literal('reorder'),input:reference,pages:pageList}).strict(),
  z.object({action:z.literal('delete'),input:reference,pages:pageList}).strict(),
  z.object({action:z.literal('fill'),input:reference,fields:z.record(z.union([z.string().max(2000),z.boolean()]))}).strict(),
  z.object({action:z.literal('compress'),input:reference}).strict(),
]);
export const planSchema = z.object({summary:z.string().min(1).max(1000),steps:z.array(actions).max(8)}).strict();
export type Plan = z.infer<typeof planSchema>;
export type Step = Plan['steps'][number];
export function planningSchema(sources: Source[]) {
  const schema=zodToJsonSchema(planSchema,{$refStrategy:"none"});
  const refs=[...sources.map(s=>s.id),'result'];
  function walk(value:unknown){
    if(!value||typeof value!=='object')return;
    const node=value as Record<string,unknown>;
    if(node.properties&&typeof node.properties==='object'){
      const props=node.properties as Record<string,Record<string,unknown>>;
      if(props.input)props.input.enum=refs;
      if(props.inputs?.items&&typeof props.inputs.items==='object')(props.inputs.items as Record<string,unknown>).enum=refs;
    }
    for(const child of Object.values(node))walk(child);
  }
  walk(schema);return schema;
}
export function parseRanges(value: string, count: number): number[] {
  const parts = value.split(',').map(s=>s.trim());
  if (!value.trim() || parts.some(p=>!/^\d+(?:-\d+)?$/.test(p))) throw Error('Use page ranges like 1-3, 5, 8.');
  const pages = parts.flatMap(part=> { const [a,b=a]=part.split('-').map(Number); if(a<1||b<a||b>count) throw Error(`Pages must be between 1 and ${count}.`); return Array.from({length:b-a+1},(_,i)=>a+i); });
  if(new Set(pages).size!==pages.length) throw Error('A page can only appear once.');
  return pages;
}
export async function executePlan(raw: unknown, sources: Source[]) {
  const plan=planSchema.parse(raw);
  if(!plan.steps.length) throw Error('No supported changes were proposed. Try a more specific command.');
  const bytes = new Map(sources.map(s=>[s.id,s.bytes]));
  const descriptions: string[]=[];
  for(const step of plan.steps) {
    const refs=step.action==='merge'?step.inputs:[step.input];
    const docs=await Promise.all(refs.map(async ref=> {const data=bytes.get(ref); if(!data) throw Error(`Unknown document: ${ref}`); return PDFDocument.load(data); }));
    let out: PDFDocument;
    const input=docs[0], count=input.getPageCount();
    if(step.action==='merge') {
      if(new Set(refs).size!==refs.length) throw Error('Merge inputs must be different documents.');
      out=await PDFDocument.create();
      for(const doc of docs) for(const p of await out.copyPages(doc,doc.getPageIndices())) out.addPage(p);
      descriptions.push(`Merge ${refs.length} PDFs → ${out.getPageCount()} pages`);
    } else if(step.action==='fill') {
      out=input; const form=out.getForm();
      if(!Object.keys(step.fields).length) throw Error('Choose at least one existing form field.');
      for(const [key,value] of Object.entries(step.fields)) {
        const field=form.getFieldMaybe(key); if(!field) throw Error(`Unknown form field: ${key}`);
        if(field.isReadOnly()) throw Error(`Field is read-only: ${key}`);
        if(field instanceof PDFTextField && typeof value==='string') field.setText(value);
        else if(field instanceof PDFCheckBox && typeof value==='boolean') value?field.check():field.uncheck();
        else if(field instanceof PDFRadioGroup&&typeof value==='string'&&field.getOptions().includes(value))field.select(value);
        else if((field instanceof PDFDropdown||field instanceof PDFOptionList)&&typeof value==='string'&&field.getOptions().includes(value)) field.select(value);
        else throw Error(`Unsupported value or field type: ${key}`);
      }
      form.updateFieldAppearances(); descriptions.push(`Fill ${Object.keys(step.fields).length} form fields`);
    } else if(step.action==='compress') {
      out=input; descriptions.push('Lossless repack: object streams; images stay unchanged');
    } else {
      if(new Set(step.pages).size!==step.pages.length || step.pages.some(p=>p>count)) throw Error(`Invalid page selection; document has ${count} pages.`);
      if(step.action==='reorder' && (step.pages.length!==count)) throw Error('Reorder must contain every page exactly once.');
      const keep=step.action==='delete'?Array.from({length:count},(_,i)=>i+1).filter(p=>!step.pages.includes(p)):step.pages;
      if(!keep.length) throw Error('Cannot delete every page.');
      out=await PDFDocument.create();
      for(const p of await out.copyPages(input,keep.map(p=>p-1))) out.addPage(p);
      descriptions.push(step.action==='delete'?`Delete pages ${step.pages.join(', ')} → ${keep.length} pages`:`${step.action==='split'?'Extract':'Reorder'} pages: ${keep.join(', ')}`);
    }
    const result=await out.save({useObjectStreams:true});
    // Repacking is not guaranteed to shrink a PDF. Retain the input when it is already smaller.
    bytes.set('result',step.action==='compress' && result.length>bytes.get(refs[0])!.length?bytes.get(refs[0])!:result);
  }
  const result=bytes.get('result')!;
  return { bytes:result, count:(await PDFDocument.load(result)).getPageCount(), descriptions };
}
export type Finding={page:number;kind:string;value:string};
export function privacyFindings(texts:string[]): Finding[] {
  const patterns:[string,RegExp][]=[['Email',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],['Possible phone',/(?<!\d)(?:\+?63[\s.-]?|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)|(?<!\d)\+?\d{1,3}[\s.-]\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}(?!\d)/g],['Possible account number',/\b(?:account|acct|iban|bank)[\s:#-]*(?:number|no\.?)?[\s:#-]*([A-Z]{2}\d{2}[A-Z0-9 ]{10,30}|\d[\d -]{6,22}\d)\b/gi]];
  return texts.flatMap((text,i)=>patterns.flatMap(([kind,re])=>[...text.matchAll(re)].slice(0,50).map(m=>({page:i+1,kind,value:kind==='Possible account number'?(m[1]?.trim()||m[0]):m[0]}))));
}

// Follow source pages through sequential operations so preview labels keep their identity.
export function sourcePages(plan:Plan,sources:Source[]){
 const documents=new Map(sources.map(d=>[d.id,Array.from({length:d.count},(_,i)=>({filename:d.name,page:i+1}))]));
 let result=documents.get(sources[0]?.id)??[];
 for(const step of plan.steps){
  if(step.action==='merge')result=step.inputs.flatMap(id=>documents.get(id)??[]);
  else {const input=documents.get(step.input)??[];result='pages'in step?(step.action==='delete'?input.filter((_,i)=>!step.pages.includes(i+1)):step.pages.map(page=>input[page-1])):input;}
  documents.set('result',result);
 }
 return result;
}
export function copyFilename(sources:Source[],action:string){const stem=(sources[0]?.name??'PDF').replace(/\.pdf$/i,'');return `${stem}-${action==='chat'?'edited':action}-copy.pdf`;}
