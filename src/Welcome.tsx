import {useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {ArrowBigUp,FileText} from 'lucide-react';
import RadialMenu,{rayAt,rays,type RayAction} from './RadialMenu';
const explanations:Record<RayAction,string>={chat:'Ask questions or request several PDF changes in one message. Review the plan before applying it.',split:'Choose pages to extract into a separate PDF.',compress:'Repack your PDF locally without reducing image quality.',fill:'Fill form fields, add text, or edit supported text blocks.',sign:'Place a visual signature on one or more pages.',reorder:'Drag page previews into the order you want.',delete:'Choose pages to remove from a new copy.',merge:'Combine PDFs, then arrange the pages before exporting.'};
export default function Welcome(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[hover,setHover]=useState<RayAction|null>(null),[chosen,setChosen]=useState<RayAction|null>(null),[dragging,setDragging]=useState(false),[position,setPosition]=useState({x:50,y:50});
 const demo=useRef<HTMLDivElement>(null),activeDrag=useRef(false);
 async function finish(){setBusy(true);try{if(isTauri())await invoke('complete_welcome');else document.body.dataset.welcomeComplete='true';}catch{setError('Couldn’t save your preference. Please try again.');}finally{setBusy(false);}}
 function update(x:number,y:number){const box=demo.current!.getBoundingClientRect(),svg=demo.current!.querySelector('svg.sun-menu')! as SVGSVGElement;setPosition({x:Math.max(0,Math.min(100,(x-box.left)/box.width*100)),y:Math.max(0,Math.min(100,(y-box.top)/box.height*100))});setHover(rayAt(svg,x,y));}
 function reset(){activeDrag.current=false;setDragging(false);setHover(null);setPosition({x:50,y:50});}
 return <main className="welcome-screen">
 <div className="welcome-intro" data-tauri-drag-region onMouseDown={e=>{if(e.button===0&&isTauri())void getCurrentWindow().startDragging().catch(()=>{});}}><h1>Welcome to SunnyDrop</h1><p>Private by Design. Works Without Wifi. Let Chat Handle the Steps.</p></div>
 <div className="welcome-layout"><div className="welcome-demo" aria-label="Hold Shift while dragging a PDF to reveal the action menu">
 <div className={`welcome-key ${dragging?'pressed':''}`}><ArrowBigUp size={30} strokeWidth={1.8}/><span>shift</span></div>
 
 <div className="welcome-sun" ref={demo}><RadialMenu hover={hover??chosen} onSelect={setChosen}/><button type="button" className={`welcome-file ${dragging?'dragging':''}`} aria-label="Drag practice PDF" style={{left:`${position.x}%`,top:`${position.y}%`}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();activeDrag.current=true;setDragging(true);setChosen(null);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(activeDrag.current)update(e.clientX,e.clientY);}} onPointerUp={e=>{if(!activeDrag.current)return;const svg=demo.current!.querySelector('svg.sun-menu')! as SVGSVGElement;setChosen(rayAt(svg,e.clientX,e.clientY));if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);reset();}} onPointerCancel={reset} onKeyDown={e=>{if(e.key==='Escape')reset();}}><FileText size={22}/><span>PDF</span></button></div>
 <div className="welcome-practice" role="status">{hover||chosen?<><strong>{rays.find(r=>r.id===(hover??chosen))?.label}</strong><span>{explanations[(hover??chosen)!]}</span></>:<strong>Try it here</strong>}</div>
 </div>
 <ol className="welcome-steps"><li><span>1</span><p>Drag a PDF from <strong>Finder or your Desktop.</strong></p></li><li><span>2</span><p><strong>Hold Shift</strong> while dragging to reveal the sun.</p></li><li><span>3</span><p><strong>Drop onto an action</strong> and export a new copy.</p></li></ol>

 </div>
 <div className="welcome-bottom"><button className="primary" disabled={busy} onClick={()=>void finish()}>{busy?'Opening…':'Let’s get started'}</button>{error&&<p role="alert">{error}</p>}</div>
 </main>;
}
