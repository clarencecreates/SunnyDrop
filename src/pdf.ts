import './polyfills';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import PDFWorker from './pdf-worker?worker&inline';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
GlobalWorkerOptions.workerPort=new PDFWorker();
export type Preview={image:string;text:string};
export type FormField={name:string;kind:'text'|'checkbox'|'select'|'radio'|'unsupported';value:string|boolean;options?:string[];readOnly?:boolean;placements?:{page:number;x:number;y:number;width:number;height:number;option?:string}[]};
export async function inspectPDF(bytes:Uint8Array) {
  const model=await PDFDocument.load(bytes);
  if(model.getPageCount()>250) throw Error('Preview supports up to 250 pages per PDF in this prototype.');
  const task=getDocument({data:bytes.slice(),useSystemFonts:true});
  const pdf=await task.promise;
  const previews:Preview[]=[];
 const placements=new Map<string,NonNullable<FormField['placements']>>();
  try {
    for(let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale:0.35});
      const canvas=document.createElement('canvas'); canvas.width=viewport.width;canvas.height=viewport.height;
      await page.render({canvasContext:canvas.getContext('2d')!,canvas,viewport}).promise;
      for(const annotation of await page.getAnnotations()){
        if(annotation.subtype!=='Widget'||!annotation.fieldName||!annotation.rect)continue;
        const rect=[...viewport.convertToViewportPoint(annotation.rect[0],annotation.rect[1]),...viewport.convertToViewportPoint(annotation.rect[2],annotation.rect[3])],x=Math.min(rect[0],rect[2]),y=Math.min(rect[1],rect[3]);
        const location={page:i,x:x/viewport.width,y:y/viewport.height,width:Math.abs(rect[2]-rect[0])/viewport.width,height:Math.abs(rect[3]-rect[1])/viewport.height,option:annotation.buttonValue||annotation.exportValue};
        placements.set(annotation.fieldName,[...(placements.get(annotation.fieldName)||[]),location]);
      }
      const text=await page.getTextContent();
      previews.push({image:canvas.toDataURL('image/png'),text:text.items.map(x=>'str' in x?x.str:'').join(' ')});
      page.cleanup();
    }
  } finally { await task.destroy(); }
  const fields:FormField[]=model.getForm().getFields().map(field=> {
    const extra={readOnly:field.isReadOnly(),placements:placements.get(field.getName())||[]};
    if(field instanceof PDFRadioGroup)return{...extra,name:field.getName(),kind:'radio',value:field.getSelected()||'',options:field.getOptions()};
    if(field instanceof PDFTextField)return{...extra,name:field.getName(),kind:'text',value:field.getText()||''};
    if(field instanceof PDFCheckBox)return{...extra,name:field.getName(),kind:'checkbox',value:field.isChecked()};
    if(field instanceof PDFDropdown||field instanceof PDFOptionList)return{...extra,name:field.getName(),kind:'select',value:field.getSelected()[0]||'',options:field.getOptions()};
    return {name:field.getName(),kind:'unsupported',value:''};
  });
  return {previews,fields,metadata:{title:model.getTitle()||'',author:model.getAuthor()||'',subject:model.getSubject()||''}};
}

export async function renderPDFPage(bytes:Uint8Array,pageNumber:number){
 const task=getDocument({data:bytes.slice(),useSystemFonts:true});
 try{const pdf=await task.promise,page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1.5});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;return canvas.toDataURL('image/png');}finally{await task.destroy();}
}
