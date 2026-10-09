import {PDFDocument,StandardFonts,degrees,rgb} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
export type PlacedText={id:string;page:number;x:number;y:number;text:string;size:number};
export async function placeText(bytes:Uint8Array,items:PlacedText[]){
 const model=await PDFDocument.load(bytes),font=await model.embedFont(StandardFonts.Helvetica),task=getDocument({data:bytes.slice()});
 try{const pdf=await task.promise;for(const item of items){if(!item.text.trim())continue;if(!Number.isInteger(item.page)||item.page<1||item.page>pdf.numPages||!Number.isFinite(item.x)||!Number.isFinite(item.y)||item.x<0||item.y<0||item.x>1||item.y>1||item.size<8||item.size>40)throw Error('Invalid text placement.');
 const page=model.getPage(item.page-1),viewport=(await pdf.getPage(item.page)).getViewport({scale:1});
 try{font.encodeText(item.text);}catch{throw Error('Text placement currently supports Latin characters. Please remove unsupported characters.');}
 const lines=item.text.split('\n');for(let i=0;i<lines.length;i++){const origin=viewport.convertToPdfPoint(item.x*viewport.width,item.y*viewport.height+item.size*(1+i*1.2));page.drawText(lines[i],{x:origin[0],y:origin[1],font,size:item.size,color:rgb(.12,.12,.12),rotate:degrees(page.getRotation().angle)});}}
 return await model.save();}finally{await task.destroy();}
}
