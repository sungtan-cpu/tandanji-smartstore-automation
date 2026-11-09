import {parse} from './core.mjs';
import {resolve} from 'node:path';

export function dateOrder(names,year){
 return names.map((name,index)=>{const plain=name.replace(/^\[\d+\]\s*/, '');const p=parse(plain,year);if(!p)throw Error('홈 상품 날짜 해석 실패: '+name);return {name,index,date:p.date};})
 .sort((a,b)=>a.date-b.date||a.index-b.index).map(p=>p.name);
}

export async function sortHome(page,{preview=false,year=new Date().getFullYear(),log=async()=>{}}={}){
 const url='https://sell.smartstore.naver.com/d/v2/display-config/home';
 await page.goto(url);
 await page.getByRole('menuitem',{name:'자유상품',exact:true}).first().waitFor();
 const table=page.getByRole('table',{name:'전시 상품',exact:true});
 const read=()=>table.getByRole('row').evaluateAll(es=>es.map(e=>e.querySelector('a')?.textContent).filter(Boolean));
 const snapshots=[];
 const count=await page.getByRole('menuitem',{name:'자유상품',exact:true}).count();
 for(let i=0;i<count;i++){
  await page.getByRole('menuitem',{name:'자유상품',exact:true}).nth(i).click();
  const title=await page.getByRole('textbox',{name:'제목을 입력하세요.',exact:true}).inputValue();
  if(!['고단백도시락','웜프 샐러드'].includes(title))continue;
  await table.getByRole('row').filter({hasText:/\[\d+\]/}).first().waitFor();
  await page.waitForFunction(title=>{const table=Array.from(document.querySelectorAll('table')).find(e=>e.querySelector('caption')?.textContent.trim()==='전시 상품');const names=Array.from(table?.querySelectorAll('tbody tr a')||[]).map(e=>e.textContent).filter(n=>/^\[\d+\]/.test(n));return names.length>0&&names.every(n=>n.includes('['+title+']'));},title);
  const before=await read();const after=dateOrder(before,year);
  if(snapshots.some(s=>s.title===title))throw Error('같은 제목의 홈 자유상품이 여러 개입니다: '+title);
  snapshots.push({title,before,after});await log({event:'home-order-plan',title,before,after});
  if(preview||JSON.stringify(before)===JSON.stringify(after))continue;
  // UI 체크박스는 입력 요소 대신 연결된 라벨을 클릭한다. 이전 선택을 모두 해제한다.
  for(const id of await table.getByRole('checkbox').evaluateAll(es=>es.filter(e=>e.checked&&e.id.startsWith('check_')).map(e=>e.id)))await page.locator(`label[for="${id}"]`).click();
  for(const name of [...after].reverse()){
   const id=name.match(/^\[(\d+)\]/)[1];
   await page.locator(`label[for="check_${id}"]`).click();
   const selected=await table.getByRole('checkbox').evaluateAll(es=>es.filter(e=>e.checked&&e.id.startsWith('check_')).map(e=>e.id));
   if(JSON.stringify(selected)!==JSON.stringify(['check_'+id]))throw Error('홈 이동 선택 상품번호 불일치');
   await page.getByRole('button',{name:'맨 위로',exact:true}).click();
   await page.waitForFunction(id=>{const table=Array.from(document.querySelectorAll('table')).find(e=>e.getAttribute('aria-label')==='전시 상품'||e.querySelector('caption')?.textContent.trim()==='전시 상품');return table?.querySelector('tbody tr a')?.textContent.startsWith('['+id+']');},id);
   await page.locator(`label[for="check_${id}"]`).click();
  }
  if(JSON.stringify(await read())!==JSON.stringify(after))throw Error('홈 순서 저장 전 검증 실패');
  await page.getByRole('button',{name:'적용하기',exact:true}).click();
  // 저장 완료가 별도 대화상자 없이 반영되므로 재진입해 서버 저장값을 확인한다.
  await page.reload();await page.getByRole('menuitem',{name:'자유상품',exact:true}).nth(i).click();
  await table.getByRole('row').filter({hasText:/\[\d+\]/}).first().waitFor();
  if(JSON.stringify(await read())!==JSON.stringify(after))throw Error('홈 순서 저장 후 검증 실패');
  await page.screenshot({path:resolve('logs',`home-${title}-${Date.now()}.png`),fullPage:true});
  await log({event:'home-order-verified',title,after});
 }
 if(snapshots.length!==2)throw Error('홈 자유상품 두 종류를 모두 찾지 못했습니다.');
 return snapshots;
}
