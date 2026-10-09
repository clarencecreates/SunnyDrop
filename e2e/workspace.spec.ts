import { test,expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { installTestBridge } from './native-bridge';
test('three PDFs: previews, privacy findings, approved merge, and export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(['samples/01-project-notes.pdf','samples/02-meeting-agenda.pdf','samples/03-privacy-example.pdf']);
 await expect(page.locator('.file-card')).toHaveCount(3);await expect(page.locator('.page-grid .page')).toHaveCount(3);
 await page.locator('.file-card').filter({hasText:'03-privacy-example.pdf'}).click();await page.getByRole('button',{name:/Privacy check/}).click();
 await expect(page.locator('.finding')).toHaveCount(3);await expect(page.locator('.page.flagged')).toHaveCount(1);
 await page.getByRole('button',{name:'Merge',exact:true}).click();await page.getByRole('button',{name:/Preview changes/}).click();
 await expect(page.locator('.review')).toContainText('7 output pages');await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Approve changes'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();
 const download=await downloadPromise;const file=await download.path();const pdf=await PDFDocument.load(await readFile(file!));expect(pdf.getPageCount()).toBe(7);
 await page.screenshot({path:'artifacts/workspace.png',fullPage:true});expect(errors).toEqual([]);
});
test('real local AI: multi-step plan, approval gate, and exported output',async({page})=>{
 await installTestBridge(page);await page.goto('/');await expect(page.locator('.model-status')).toContainText('Qwen3');
 await page.locator('input[type=file]').setInputFiles(['samples/01-project-notes.pdf','samples/02-meeting-agenda.pdf']);await expect(page.locator('.file-card')).toHaveCount(2);
 await page.getByRole('textbox',{name:'Tell local AI what to do'}).fill('Merge the selected PDFs, then delete page 2 from the merged result.');await page.getByRole('button',{name:'Ask local AI',exact:true}).click();
 await expect(page.locator('.review')).toContainText('4 output pages',{timeout:60000});await expect(page.locator('.result')).toHaveCount(0);await page.screenshot({path:'artifacts/local-ai-plan.png'});
 await page.getByRole('button',{name:'Approve changes'}).click();await page.getByRole('button',{name:'Export PDF',exact:true}).click();await expect(page.locator('.notice')).toContainText('Saved locally');const result=await PDFDocument.load(await readFile('artifacts/ui-ai-output.pdf'));expect(result.getPageCount()).toBe(4);
});
test('fillable form: edits survive approval and export',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles('samples/04-fillable-form.pdf');await expect(page.locator('.file-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Fill',exact:true}).click();await page.getByLabel('full_name',{exact:true}).fill('Alex Demo');await page.getByLabel('email',{exact:true}).fill('alex@example.test');await page.getByLabel('approved',{exact:true}).check();
 await page.getByRole('button',{name:/Preview changes/}).click();await page.getByRole('button',{name:'Approve changes'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const download=await downloadPromise;const pdf=await PDFDocument.load(await readFile((await download.path())!));expect(pdf.getForm().getTextField('full_name').getText()).toBe('Alex Demo');expect(pdf.getForm().getCheckBox('approved').isChecked()).toBe(true);
});
