import { useState, useEffect, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sun, Plus, Combine, Scissors, Grip, ListOrdered, FilePenLine, Minimize2, Trash2, ShieldCheck, ArrowUp, Download, X, Check, LoaderCircle, FileText, RefreshCw, ChevronRight } from 'lucide-react';
import { executePlan, copyFilename, parseRanges, planSchema, planningSchema, privacyFindings, type Source, type Plan } from './core';
import { inspectPDF, type Preview, type FormField } from './pdf';
type Doc=Source & {previews:Preview[];fields:FormField[];metadata:{title:string;author:string;subject:string}};
type Review={plan:Plan;bytes:Uint8Array;count:number;descriptions:string[];previews:Preview[]};
const actions=[{id:'merge',label:'Merge',icon:Combine},{id:'split',label:'Split',icon:Scissors},{id:'reorder',label:'Reorder',icon:ListOrdered},{id:'fill',label:'Fill',icon:FilePenLine},{id:'compress',label:'Compress',icon:Minimize2},{id:'delete',label:'Delete pages',icon:Trash2}] as const;
type Action=typeof actions[number]['id'];
function decode(data:string){return Uint8Array.from(atob(data),c=>c.charCodeAt(0));}
function encode(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export default function App(){
  const [docs,setDocs]=useState<Doc[]>([]), [active,setActive]=useState(''), [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dragging,setDragging]=useState(false);
  const [action,setAction]=useState<Action|null>(null),[range,setRange]=useState(''),[order,setOrder]=useState<number[]>([]),[fieldValues,setFieldValues]=useState<Record<string,string|boolean>>({});
  const [review,setReview]=useState<Review|null>(null),[result,setResult]=useState<Review|null>(null);
  const [command,setCommand]=useState(''),[ai,setAI]=useState('Checking local model…'),[aiReady,setAIReady]=useState(false),[privacy,setPrivacy]=useState(false);
  const input=useRef<HTMLInputElement>(null), docsRef=useRef(docs), loading=useRef(false), pageDrag=useRef<number|null>(null);
  docsRef.current=docs;
  const doc=docs.find(d=>d.id===active), findings=doc?privacyFindings(doc.previews.map(p=>p.text)):[];
  async function refreshAI(){try{if(!isTauri())throw Error('Open the native app for Ollama');const status=await invoke<{models:{name:string}[]}>('ai_status');const ready=status.models.some(m=>m.name==='qwen3.5:4b');setAIReady(ready);setAI(ready?'Qwen3.5 4B · on this Mac':'Model missing: ollama pull qwen3.5:4b');}catch{setAIReady(false);setAI('Ollama offline · start ollama serve');}}
  useEffect(()=>{void refreshAI();},[]);
  async function addFiles(files:{name:string;bytes:Uint8Array}[], dropAction?:Action){
    if(loading.current)return;
    loading.current=true;setBusy('Reading PDFs and rendering previews…');setError('');setNotice('');
    try{if(docsRef.current.length+files.length>12)throw Error('Keep up to 12 PDFs in this workspace.');const incoming:Doc[]=[];
      for(const file of files){if(file.bytes.length>60*1024*1024)throw Error('Each PDF must be under 60 MB.');const details=await inspectPDF(file.bytes);incoming.push({...file,...details,id:`doc-${crypto.randomUUID().slice(0,8)}`,count:details.previews.length});}
      setDocs(prev=>[...prev,...incoming]);if(incoming.length){setActive(incoming[0].id);setSelected(prev=>[...prev,...incoming.map(d=>d.id)]);setReview(null);setResult(null);setAction(dropAction||null);setRange('');setOrder(Array.from({length:incoming[0].count},(_,i)=>i+1));setFieldValues(Object.fromEntries(incoming[0].fields.filter(f=>f.kind!=='unsupported').map(f=>[f.name,f.value])));}
    }catch(e){setError(`Could not open PDF: ${e instanceof Error?e.message:String(e)}. Encrypted PDFs must be unlocked first.`);}finally{setBusy('');loading.current=false;}
  }
  useEffect(()=>{if(!isTauri())return;let disposed=false;let unlisten:(()=>void)|undefined;
    void getCurrentWindow().onDragDropEvent(event=>{const data=event.payload;if(data.type==='enter'||data.type==='over')setDragging(true);else setDragging(false);if(data.type==='drop'){
      const x=data.position.x,y=data.position.y;
      const ray=[...document.querySelectorAll<HTMLElement>('[data-action]')].find(el=>{const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
      const dropAction=ray?.dataset.action as Action|undefined;
      void invoke<{name:string;data:string}[]>('read_dropped_pdfs',{paths:data.paths}).then(files=>addFiles(files.map(f=>({name:f.name,bytes:decode(f.data)})),dropAction)).catch(e=>setError(String(e)));
    }}).then(fn=>{if(disposed)fn();else unlisten=fn;});return()=>{disposed=true;unlisten?.();};
  },[]);
  async function choose(){if(busy)return;setError('');if(isTauri()){try{const files=await invoke<{name:string;data:string}[]>('choose_pdfs');await addFiles(files.map(f=>({name:f.name,bytes:decode(f.data)})));}catch(e){setError(String(e));}}else input.current?.click();}
  function chooseAction(next:Action){if(busy)return;if(!docs.length){void choose();return;}setReview(null);setAction(next);setRange('');setOrder(Array.from({length:doc?.count||0},(_,i)=>i+1));setFieldValues(Object.fromEntries((doc?.fields||[]).filter(f=>f.kind!=='unsupported').map(f=>[f.name,f.value])));setError('');}
  async function prepare(plan:Plan){setBusy('Validating changes and preparing a preview…');setError('');setReview(null);try{const output=await executePlan(plan,docs);const {previews}=await inspectPDF(output.bytes);setReview({plan,...output,previews});setAction(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}}
  function manualPlan(){if(!action||!doc)return;try{let step:Plan['steps'][number];
    if(action==='merge')step={action,inputs:selected};
    else if(action==='split'||action==='delete')step={action,input:doc.id,pages:parseRanges(range,doc.count)};
    else if(action==='reorder')step={action,input:doc.id,pages:order};
    else if(action==='fill')step={action,input:doc.id,fields:fieldValues};
    else step={action:'compress',input:doc.id};
    void prepare({summary:`${actions.find(a=>a.id===action)?.label} ${action==='merge'?'selected PDFs':doc.name}`,steps:[step]});
  }catch(e){setError(e instanceof Error?e.message:String(e));}}
  async function askAI(){if(!command.trim()||busy||!docs.length)return;setBusy('Local AI is planning your changes…');setError('');setReview(null);
    try{const context=JSON.stringify(docs.map(d=>({id:d.id,name:d.name,pages:d.count,selected:selected.includes(d.id),active:d.id===active,fields:d.fields,metadata:d.metadata,textByPage:d.previews.slice(0,12).map((p,i)=>({page:i+1,text:p.text.slice(0,220)}))})));
      const response=await invoke<string>('propose_plan',{command,context,schema:planningSchema(docs)});
      const plan=planSchema.parse(JSON.parse(response));if(!plan.steps.length)throw Error(plan.summary);setBusy('');await prepare(plan);
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy('');}
  }
  async function exportResult(){if(!result)return;setBusy('Saving a local copy…');try{const name=copyFilename(docs,action??'edited');if(isTauri()){const path=await invoke<string|null>('export_pdf',{name,data:encode(result.bytes)});if(path)setNotice(`Saved locally: ${path}`);}else{const url=URL.createObjectURL(new Blob([result.bytes.slice().buffer],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);setNotice('Exported a new PDF copy.');}}catch(e){setError(String(e));}finally{setBusy('');}}
  function selectDoc(id:string){if(busy)return;setActive(id);setAction(null);setReview(null);setRange('');setOrder([]);}
  const total=docs.reduce((n,d)=>n+d.count,0);
  return <div className={`app ${dragging?'drag-active':''}`} onDragOver={e=>{e.preventDefault();if(!isTauri())setDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);if(!isTauri())void Promise.all([...e.dataTransfer.files].map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())}))).then(addFiles);}}>
    <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e=>{void Promise.all([...e.target.files||[]].map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())}))).then(addFiles);e.target.value='';}}/>
    <header data-tauri-drag-region><div className="brand"><div className="brand-icon"><Sun size={23}/></div><strong>SunnyDrop</strong><span className="tag">LOCAL PDF WORKSPACE</span></div><div className="private"><ShieldCheck size={14}/> Files stay on this Mac</div></header>
    <div className="layout">
      <aside className="files"><div className="section-label">YOUR WORKSPACE <span>{docs.length}</span></div><button className="add" onClick={choose} disabled={!!busy}><Plus size={16}/> Add PDFs</button>
        {!docs.length?<div className="file-empty"><FileText size={26}/><p>A little less paperwork.<br/>A lot more sunshine.</p></div>:docs.map(d=><div key={d.id} className={`file-card ${active===d.id?'active':''}`} onClick={()=>selectDoc(d.id)} draggable={!busy} onDragStart={e=>{e.dataTransfer.setData("sunnydoc",d.id);}}>
          <input aria-label={`Select ${d.name} for merge`} type="checkbox" disabled={!!busy} checked={selected.includes(d.id)} onClick={e=>e.stopPropagation()} onChange={e=>{setSelected(prev=>e.target.checked?[...prev,d.id]:prev.filter(id=>id!==d.id));setReview(null);}}/>
          <div className="file-thumb"><img src={d.previews[0]?.image}/></div><div className="file-meta"><strong title={d.name}>{d.name}</strong><span>{d.count} pages · {(d.bytes.length/1024).toFixed(0)} KB</span></div>
          <button aria-label={`Remove ${d.name} from workspace`} className="icon remove" disabled={!!busy} onClick={e=>{e.stopPropagation();setDocs(prev=>prev.filter(x=>x.id!==d.id));setSelected(prev=>prev.filter(id=>id!==d.id));if(active===d.id)setActive(docs.find(x=>x.id!==d.id)?.id||'');setReview(null);setResult(null);setAction(null);}}><X size={13}/></button>
        </div>)}
        <div className="sidebar-bottom"><span className="dot"/> No cloud uploads<p>{total} pages in your workspace</p></div>
      </aside>
      <main>
        <div className="intro"><div><span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>Your PDFs, on the bright side.</h1><p>Drop a document. Pick a ray. Or ask your local AI.</p></div></div>
        <section className={`sun-stage ${docs.length||dragging?'has-files':''}`}>
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
          {actions.map((a,i)=>{const angle=(i*60-90)*Math.PI/180;return <button key={a.id} data-action={a.id} className={`ray ${action===a.id?'chosen':''}`} style={{left:`calc(50% + ${Math.cos(angle)*172}px)`,top:`calc(50% + ${Math.sin(angle)*136}px)`}} disabled={!!busy} onClick={()=>chooseAction(a.id)} onDrop={e=>{if(docs.length&&e.dataTransfer.getData('sunnydoc')){e.preventDefault();e.stopPropagation();chooseAction(a.id);}}}><a.icon size={20}/><span>{a.label}</span></button>;})}
          <button className="sun-core" onClick={choose} disabled={!!busy}><Sun size={51} strokeWidth={1.25}/><strong>{dragging?'Let it drop.':docs.length?`${docs.length} PDF${docs.length>1?'s':''} ready`:'Drop your PDFs'}</strong><span>{docs.length?'Choose a ray to get started':'or click to browse'}</span></button>
          <span className="sun-caption">A brighter way to get things done.</span>
        </section>
        {busy&&<div className="status"><LoaderCircle className="spin" size={16}/>{busy}</div>}
        {error&&<div role="alert" className="alert"><span>{error}</span><button className="icon" onClick={()=>setError('')}><X size={15}/></button></div>}
        {notice&&<div className="notice"><Check size={16}/>{notice}</div>}
        {action&&doc&&<section className="tool-panel"><div className="panel-head"><h2>{actions.find(a=>a.id===action)?.label}</h2><button className="icon" onClick={()=>setAction(null)}><X size={18}/></button></div>
          {action==='merge'?<p>Merge {selected.length} selected PDFs in workspace order. Check files in the left sidebar.</p>:<p>{doc.name} · {doc.count} pages</p>}
          {(action==='split'||action==='delete')&&<label className="field-label">{action==='split'?'Pages to extract':'Pages to remove'}<input placeholder="For example: 1-3, 5" value={range} onChange={e=>setRange(e.target.value)}/></label>}
          {action==='reorder'&&<p className="hint">Drag the page thumbnails below into a new order.</p>}
          {action==='compress'&&<p className="hint">Lossless repacking reduces PDF structure overhead. Image quality is unchanged; some files may not shrink.</p>}
          {action==='fill'&&(doc.fields.length?<div className="form-fields">{doc.fields.map(f=><label key={f.name} className="field-label">{f.name}{f.kind==='checkbox'?<input type="checkbox" checked={Boolean(fieldValues[f.name])} onChange={e=>setFieldValues(v=>({...v,[f.name]:e.target.checked}))}/>:f.kind==='select'?<select value={String(fieldValues[f.name]||'')} onChange={e=>setFieldValues(v=>({...v,[f.name]:e.target.value}))}><option value="">Choose…</option>{f.options?.map(o=><option key={o}>{o}</option>)}</select>:<input disabled={f.kind==='unsupported'} value={String(fieldValues[f.name]||'')} placeholder={f.kind==='unsupported'?'Unsupported field type':''} onChange={e=>setFieldValues(v=>({...v,[f.name]:e.target.value}))}/>}</label>)}</div>:<p>No interactive form fields found. SunnyDrop cannot fill a flat or scanned form.</p>)}
          <button className="primary" onClick={manualPlan} disabled={!!busy||(action==='fill'&&!doc.fields.length)||(action==='merge'&&selected.length<2)}>Preview changes <ChevronRight size={15}/></button>
        </section>}
        {doc&&<section className="pages-panel"><div className="panel-head"><h2>{action==='reorder'?'Drag to arrange pages':'Page preview'} <span>{doc.count}</span></h2><button className={`subtle ${privacy?'on':''}`} onClick={()=>setPrivacy(!privacy)}><ShieldCheck size={15}/> Privacy check {findings.length>0&&<b>{findings.length}</b>}</button></div>
          {privacy&&<div className="privacy"><strong>{findings.length?`${findings.length} potential sensitive items`:'No pattern matches in extracted text'}</strong><p>Pattern checks can miss sensitive information, especially in scans. Excluding a page removes the whole page; this is not secure redaction.</p>{findings.map((f,i)=><div key={i} className="finding"><span>Page {f.page}</span><b>{f.kind}</b><code>{f.value}</code></div>)}{findings.length>0&&<button className="subtle" disabled={!!busy} onClick={()=>void prepare({summary:'Exclude pages flagged by the privacy check',steps:[{action:'delete',input:doc.id,pages:[...new Set(findings.map(f=>f.page))]}]})}>Review excluding flagged pages</button>}</div>}
          <div className="page-grid">{(action==='reorder'?order:Array.from({length:doc.count},(_,i)=>i+1)).map((page,i)=><div className={`page ${privacy&&findings.some(f=>f.page===page)?'flagged':''}`} key={page} draggable={action==='reorder'} onDragStart={e=>{pageDrag.current=page;e.dataTransfer.setData('text/plain',String(page));}} onDragOver={e=>{if(action==='reorder')e.preventDefault();}} onDrop={e=>{if(action!=='reorder')return;e.preventDefault();e.stopPropagation();const from=pageDrag.current;if(from===null||from===page)return;setOrder(current=>{const updated=current.filter(p=>p!==from);updated.splice(current.indexOf(page),0,from);return updated;});pageDrag.current=null;}}><img src={doc.previews[page-1].image} alt={`Page ${page}`}/><div><span>{action==='reorder'?`${i+1} · ${doc.name} · page ${page}`:`Page ${page}`}</span>{action==='reorder'?<Grip size={13}/>:privacy&&findings.some(f=>f.page===page)?<ShieldCheck size={14}/>:null}</div></div>)}</div>
        </section>}
        {result&&<section className="result"><div><Check size={22}/><h2>Your new PDF is ready</h2><p>{result.count} pages · {(result.bytes.length/1024).toFixed(0)} KB · originals preserved</p></div><button className="primary" onClick={exportResult} disabled={!!busy}><Download size={16}/> Export PDF</button><div className="result-thumbs">{result.previews.slice(0,8).map((p,i)=><img key={i} src={p.image} alt={`Output page ${i+1}`}/>)}</div></section>}
      </main>
      <aside className="assistant"><div className="assistant-title"><Sun size={20}/><strong>A little local help</strong><span className="beta">AI</span></div><button className={`model-status ${aiReady?'ready':''}`} onClick={refreshAI} title="Refresh model status"><span className="dot"/>{ai}<RefreshCw size={12}/></button>
        <div className="assistant-welcome"><div className="small-sun"><Sun size={28}/></div><h2>What would you like to do?</h2><p>Tell me the changes. I’ll turn them into a plan you can review.</p><div className="examples">{['Merge the selected PDFs','Reverse the pages of the active PDF','Delete page 2 of the active PDF'].map(text=><button key={text} onClick={()=>setCommand(text)}>{text}<ArrowUp size={13}/></button>)}</div></div>
        <div className="local-note"><ShieldCheck size={17}/><p>Inference runs in Ollama on your Mac. Document text stays local.</p></div>
        {review&&<div className="review"><span className="eyebrow">REVIEW BEFORE APPLYING</span><h3>{review.plan.summary}</h3><ol>{review.descriptions.map((d,i)=><li key={i}>{d}</li>)}</ol><p>{review.count} output pages · originals preserved</p>{docs.some(d=>d.fields.length)&&review.plan.steps.some(s=>['merge','split','reorder','delete'].includes(s.action))&&<p className="warning">Page operations may remove interactive form fields or document-level features.</p>}<div className="review-thumbs">{review.previews.slice(0,4).map((p,i)=><img key={i} src={p.image} alt={`Planned output page ${i+1}`}/>)}</div><button className="primary" disabled={!!busy} onClick={()=>{setResult(review);setReview(null);setNotice('Changes approved. Export your new PDF when ready.');}}><Check size={16}/> Approve changes</button><button className="subtle" disabled={!!busy} onClick={()=>setReview(null)}>Discard plan</button></div>}
        <div className="command-box"><textarea aria-label="Tell local AI what to do" placeholder="Tell SunnyDrop what to do…" value={command} onChange={e=>setCommand(e.target.value)} maxLength={4000} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void askAI();}}}/><div><span>{docs.length?'Always reviewed by you':'Add a PDF to begin'}</span><button aria-label="Ask local AI" onClick={askAI} disabled={!!busy||!aiReady||!docs.length||!command.trim()}><ArrowUp size={18}/></button></div></div>
        <p className="assistant-foot">No uploads. No cloud model. Your call.</p>
      </aside>
    </div>
  </div>;
}
