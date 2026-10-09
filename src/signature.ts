import {PDFDocument,degrees} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
export async function applySignature(bytes:Uint8Array,pageNumber:number,png:string,rect:{x:number;y:number;width:number;height:number}){
 if(!Object.values(rect).every(Number.isFinite)||rect.x<0||rect.y<0||rect.width<=0||rect.height<=0||rect.x+rect.width>1.00001||rect.y+rect.height>1.00001)throw Error('Place the signature inside the page.');
 const model=await PDFDocument.load(bytes);if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>model.getPageCount())throw Error('Invalid signing page.');
 const task=getDocument({data:bytes.slice(),useSystemFonts:true});
 try{const pdf=await task.promise,rendered=await pdf.getPage(pageNumber),viewport=rendered.getViewport({scale:1}),origin=viewport.convertToPdfPoint(rect.x*viewport.width,(rect.y+rect.height)*viewport.height),page=model.getPage(pageNumber-1),image=await model.embedPng(png);
 page.drawImage(image,{x:origin[0],y:origin[1],width:rect.width*viewport.width,height:rect.height*viewport.height,rotate:degrees(page.getRotation().angle)});
 return await model.save();}finally{await task.destroy();}
}
