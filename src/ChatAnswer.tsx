import {Fragment} from 'react';
function inline(text:string){return text.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:<Fragment key={i}>{part}</Fragment>);}
export default function ChatAnswer({text}:{text:string}){
 const lines=text.split('\n'),blocks=[];let i=0;
 while(i<lines.length){if(!lines[i].trim()){i++;continue;}const list=/^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i]);if(list){const ordered=/^\s*\d+[.)]/.test(lines[i]),items=[];while(i<lines.length&&/^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i])){items.push(<li key={i}>{inline(lines[i++].replace(/^\s*(?:[-*•]|\d+[.)])\s+/,''))}</li>);}blocks.push(ordered?<ol key={i}>{items}</ol>:<ul key={i}>{items}</ul>);}else{const paragraph=[];while(i<lines.length&&lines[i].trim()&&!/^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i]))paragraph.push(lines[i++].replace(/^#{1,6}\s+/,''));blocks.push(<p key={i}>{inline(paragraph.join(' '))}</p>);}}
 return <div className="chat-answer">{blocks}</div>;
}
