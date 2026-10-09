import {useState,useEffect} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {MessageCircle,Scissors,Minimize2,FilePenLine,Signature,ListOrdered,Trash2,Combine} from 'lucide-react';
export const rays=[{id:'chat',label:'Chat',icon:MessageCircle},{id:'split',label:'Split',icon:Scissors},{id:'compress',label:'Compress',icon:Minimize2},{id:'fill',label:'Fill',icon:FilePenLine},{id:'sign',label:'Sign',icon:Signature},{id:'reorder',label:'Reorder',icon:ListOrdered},{id:'delete',label:'Delete',icon:Trash2},{id:'merge',label:'Merge',icon:Combine}] as const;
export type RayAction=typeof rays[number]['id'];
export const silhouette='m349.4 276.5 54.7 18.2a57.7 57.7 0 1 0 0-109.4l-54.7 18.2a57.4 57.4 0 0 1-27.1 2.4c5.1-7 12-13 20.8-17.5l51.6-25.8a57.7 57.7 0 1 0-77.3-77.3l-25.8 51.6a57.4 57.4 0 0 1-17.5 20.8 57.4 57.4 0 0 1 2.4-27.1l18.2-54.7a57.6 57.6 0 1 0-109.4 0l18.2 54.7a57.4 57.4 0 0 1 2.4 27.1 57.3 57.3 0 0 1-17.5-20.8l-25.8-51.6a57.7 57.7 0 1 0-77.3 77.3l51.5 25.8a57.4 57.4 0 0 1 21 17.5c-8.7 1.4-18 .7-27.2-2.4l-54.7-18.2a57.7 57.7 0 1 0 0 109.4l54.7-18.2a57.4 57.4 0 0 1 27.1-2.4 57.3 57.3 0 0 1-20.8 17.5l-51.6 25.8a57.7 57.7 0 1 0 77.3 77.3l25.8-51.5a57.4 57.4 0 0 1 17.5-21c1.4 8.7.7 18-2.4 27.2l-18.2 54.7a57.7 57.7 0 1 0 109.4 0l-18.2-54.7a57.4 57.4 0 0 1-2.4-27.1c7 5.1 13 12 17.5 20.9l25.8 51.5a57.7 57.7 0 1 0 77.4-77.4l-51.6-25.7a57.4 57.4 0 0 1-21-17.5c8.7-1.4 18-.7 27.2 2.4ZM240 300a60 60 0 1 1 0-120 60 60 0 0 1 0 120Z';
export function rayAt(svg:SVGSVGElement,x:number,y:number):RayAction|null {
 const r=svg.getBoundingClientRect(),px=(x-r.left)*480/r.width,py=(y-r.top)*480/r.height;
 const path=svg.querySelector<SVGGeometryElement>('.sun-silhouette');
 if(!path?.isPointInFill(new DOMPoint(px,py)))return null;
 const index=Math.round((Math.atan2(py-240,px-240)+Math.PI/2+Math.PI*2)%(Math.PI*2)/(Math.PI/4))%8;
 return rays[index].id;
}
export default function RadialMenu({hover,onHover,onDrop,onSelect,entranceKey=0}:{entranceKey?:number;hover?:RayAction|null;onHover?:(a:RayAction|null)=>void;onDrop?:(a:RayAction,e:React.DragEvent)=>void;onSelect?:(a:RayAction)=>void}){
 const [local,setLocal]=useState<RayAction|null>(null),active=hover===undefined?local:hover;
 useEffect(()=>{if(active&&isTauri())void invoke('play_ray_note',{ray:active}).catch(()=>{});},[active]);
 const update=(a:RayAction|null)=>{setLocal(a);onHover?.(a);};
 return <svg className="sun-menu" viewBox="0 0 480 480" aria-label="SunnyDrop actions" onPointerMove={e=>update(rayAt(e.currentTarget,e.clientX,e.clientY))} onPointerLeave={()=>update(null)} onDragOver={e=>{e.preventDefault();update(rayAt(e.currentTarget,e.clientX,e.clientY));}} onDragLeave={()=>update(null)} onDrop={e=>{e.preventDefault();e.stopPropagation();const a=rayAt(e.currentTarget,e.clientX,e.clientY);if(a)onDrop?.(a,e);update(null);}}>
 <defs><clipPath id="sun-clip"><path d={silhouette} fillRule="evenodd"/></clipPath></defs>
 <path className="sun-silhouette" d={silhouette} fill="transparent" fillRule="evenodd" pointerEvents="none"/>
 <g className="sun-entry" key={entranceKey}>
 {active&&<g clipPath="url(#sun-clip)" pointerEvents="none">{(()=>{const i=rays.findIndex(r=>r.id===active),t=(-90+i*45)*Math.PI/180,a=t-Math.PI/8,b=t+Math.PI/8;return <path fill="#ffd500" stroke="#ffd500" strokeWidth="2" d={`M240 240 L${240+400*Math.cos(a)} ${240+400*Math.sin(a)} A400 400 0 0 1 ${240+400*Math.cos(b)} ${240+400*Math.sin(b)} Z`}/>;})()}</g>}
 <g>{[...rays].sort((a,b)=>Number(a.id===active)-Number(b.id===active)).map(ray=>{const i=rays.findIndex(r=>r.id===ray.id);const t=(-90+i*45)*Math.PI/180,a=t-Math.PI/8,b=t+Math.PI/8,Icon=ray.icon;const path=`M240 240 L${240+400*Math.cos(a)} ${240+400*Math.sin(a)} A400 400 0 0 1 ${240+400*Math.cos(b)} ${240+400*Math.sin(b)} Z`;return <g key={ray.id} className={`ray-surface ${active===ray.id?'raised':''}`} style={{transformOrigin:`${240+177*Math.cos(t)}px ${240+177*Math.sin(t)}px`}} role="button" aria-label={ray.label} tabIndex={onSelect?0:-1} data-ray={ray.id} onClick={()=>onSelect?.(ray.id)} onFocus={()=>update(ray.id)} onBlur={()=>update(null)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onSelect?.(ray.id);}}><g clipPath="url(#sun-clip)"><path className={`sun-sector ${active===ray.id?'highlighted':''}`} d={path} stroke={active===ray.id?'#ffd500':'#ffeca3'} strokeWidth="1.5"/></g><Icon x={240+177*Math.cos(t)-17} y={240+177*Math.sin(t)-25} width={34} height={34} strokeWidth={2.4} className="ray-icon"/><text x={240+177*Math.cos(t)} y={240+177*Math.sin(t)+27} textAnchor="middle" className="ray-label">{ray.label}</text></g>;})}</g>
 </g></svg>;
}
