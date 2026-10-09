import type {Source} from './core';
import type {Preview,FormField} from './pdf';
import type {chatContext} from './chat';
type Doc=Source&{previews:Preview[];fields:FormField[]};
type Chunk={page:number;text:string;vector:number[]};
export type Embed=(texts:string[])=>Promise<number[][]>;
// Index only the attached document bytes. Closing the popup releases the in-memory cache.
const indexes=new WeakMap<Uint8Array,Promise<Chunk[]>>();
export function chunksFor(previews:Pick<Preview,'text'>[]):Omit<Chunk,'vector'>[]{
 return previews.flatMap((p,i)=>{const text=p.text.trim(),chunks=[];for(let start=0;start<text.length;start+=1000){chunks.push({page:i+1,text:text.slice(start,start+1200)});if(start+1200>=text.length)break;}return chunks;});
}
export function cosine(a:number[],b:number[]){if(!a.length||a.length!==b.length)throw Error('Incompatible local search vectors.');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
async function index(doc:Doc,embed:Embed){let pending=indexes.get(doc.bytes);if(!pending){pending=(async()=>{if(doc.count>200||doc.previews.reduce((n,p)=>n+p.text.length,0)>200000)throw Error('Local chat supports up to 200 pages and 200,000 extracted characters per PDF. Split this document first.');const chunks=chunksFor(doc.previews);const out:Chunk[]=[];for(let i=0;i<chunks.length;i+=24){const batch=chunks.slice(i,i+24),vectors=await embed(batch.map(c=>'search_document: '+c.text));if(vectors.length!==batch.length)throw Error('Incomplete local document index.');out.push(...batch.map((c,j)=>({...c,vector:vectors[j]})));}return out;})();indexes.set(doc.bytes,pending);pending.catch(()=>indexes.delete(doc.bytes));}return pending;}
export async function retrieveContext(docs:Doc[],query:string,embed:Embed,history=''):Promise<ReturnType<typeof chatContext>>{
 const summary=/summari[sz]|overview|key points/i.test(query);
 const small=docs.reduce((sum,d)=>sum+d.previews.reduce((n,p)=>n+p.text.length,0),0)<=8000;
 const all=[];for(const doc of docs)all.push(summary||small?chunksFor(doc.previews).map(c=>({...c,vector:[]})):await index(doc,embed));
 let ranked:{di:number;chunk:Chunk;score:number}[]=[];
 if(small){all.forEach((chunks,di)=>chunks.forEach(chunk=>ranked.push({di,chunk,score:1})));}
 else if(summary){all.forEach((chunks,di)=>{const n=Math.min(chunks.length,Math.max(2,Math.floor(20/docs.length)));for(let i=0;i<n;i++)ranked.push({di,chunk:chunks[Math.round(i*(chunks.length-1)/Math.max(1,n-1))],score:1});});}
 else if(all.some(c=>c.length)){const [vector]=await embed(['search_query: '+query+'\nRecent conversation: '+history.slice(-1500)]);const scored=all.flatMap((chunks,di)=>chunks.map(chunk=>({di,chunk,score:cosine(vector,chunk.vector)}))).sort((a,b)=>b.score-a.score);ranked=scored.slice(0,20);for(let di=0;di<docs.length;di++){const best=scored.find(c=>c.di===di);if(best&&!ranked.includes(best))ranked.push(best);}}
 return docs.map((d,di)=>{let budget=Math.floor(12000/docs.length);const selected=ranked.filter(c=>c.di===di).sort((a,b)=>b.score-a.score);const pages=new Map<number,string[]>();for(const {chunk} of selected){if(budget<=0)break;const text=chunk.text.slice(0,budget);budget-=text.length;pages.set(chunk.page,[...pages.get(chunk.page)||[],text]);}return{id:d.id,filename:d.name,pages:d.count,active:di===0,fields:d.fields.map(f=>({name:f.name,kind:f.kind,options:f.options,readOnly:f.readOnly})),textByPage:[...pages].sort(([a],[b])=>a-b).map(([page,text])=>({page,text:text.join('\n…\n')}))};});
}
