import {chromium} from 'playwright';
import {resolve} from 'node:path';
export async function connect(){
 const context=await chromium.launchPersistentContext(resolve('profile'),{headless:false,timezoneId:'Asia/Seoul',locale:'ko-KR'});
 const page=context.pages()[0]||await context.newPage();
 page.on('dialog',async d=>{if(d.type()==='beforeunload'||d.message().includes('저장하지 않고'))await d.accept();else await d.dismiss();});
 await page.goto('https://sell.smartstore.naver.com/#/products/origin-list');
 console.log('네이버 아이디 tandanji_box로 로그인하세요. 비밀번호와 추가 인증은 브라우저에서 직접 입력하세요. 최대 10분 대기합니다.');
 await page.getByRole('link',{name:'tandanji_box 님 내정보',exact:true}).waitFor({timeout:600000});
 if(!page.url().includes('origin-list'))await page.goto('https://sell.smartstore.naver.com/#/products/origin-list');
 await page.getByRole('heading',{name:/상품 조회\/수정/}).waitFor();
 return {context,page};
}
export async function inventory(page,status='전체'){
 const expected=Number((await page.getByRole('link',{name:new RegExp(`^${status} \\d+건$`)}).innerText()).match(/(\d+)\s*건/)[1]);
 await page.getByRole('link',{name:new RegExp(`^${status} \\d+건$`)}).click();
 await page.getByRole('button',{name:'검색',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='검색')?.disabled);
 await page.waitForFunction(n=>Array.from(document.querySelectorAll('h3')).some(e=>new RegExp('상품목록.*총\\s*'+n+'\\s*개').test(e.textContent)),expected);
 const heading=await page.getByRole('heading',{name:/상품목록/}).innerText();
 const total=Number(heading.match(/총\s*(\d+)개/)[1]);
 const rows=page.getByRole('grid').getByRole('row');
 const products=await rows.evaluateAll(es=>es.flatMap(e=>{
   const id=e.querySelector('[col-id="storefarmChannelProductNo"] a')?.textContent.trim();
   const name=e.querySelector('[col-id="productName"]')?.textContent.trim();
   return id&&name?[{id,name}]:[];
 }));
 if(products.length!==total)throw Error(`전체 목록 수집 불완전 (${products.length}/${total}). 페이지/화면 구조 확인 필요. 수정 중단.`);
 return products.map(p=>({...p,status}));
}
export async function openProduct(page,id){
 const row=page.getByRole('grid').getByRole('row').filter({hasText:id});
 if(await row.count()!==1)throw Error(`상품번호가 유일하지 않음: ${id}`);
 await row.getByRole('button',{name:'수정',exact:true}).click();
 await page.getByRole('textbox',{name:'상품명 입력',exact:true}).waitFor();
}
export async function chooseDate(page,index,iso,isEnd){
 const [date,time]=iso.split('T');const [y,m,d]=date.split('-').map(Number);
 await page.getByRole('button',{name:'달력보기',exact:true}).nth(index).click();
 const header=page.locator('.datetimepicker-header:visible');
 for(let step=0;step<24;step++){
   const txt=await header.locator('button.title').innerText();
   const parts=txt.match(/(\d{4})\.(\d{2})/);if(!parts)throw Error('달력 월 해석 실패');
   const diff=(y-Number(parts[1]))*12+m-Number(parts[2]);if(!diff)break;
   await header.locator(diff>0?'.next button.right':'.prev button.left').last().click();
   if(step===23)throw Error('달력 이동 범위 초과');
 }
 // 월 경계에 인접 월 날짜가 중복되므로 현재 월에 속한 셀만 사용한다.
 const cells=page.getByRole('cell',{name:String(d),exact:true});
 const usable=await cells.evaluateAll(es=>es.map((e,i)=>({i,classes:e.className,text:e.outerHTML})));
 const current=usable.filter(x=>!/(past|future|disabled|old|new|off)/i.test(x.classes));
 if(current.length!==1)throw Error('달력 날짜 선택 모호: '+date);
 await cells.nth(current[0].i).click();
 await page.getByText(`${Number(time.slice(0,2))}:${isEnd?'59':'00'}`,{exact:true}).click();
}
export async function fields(page){return page.getByRole('textbox',{name:'날짜 입력'}).evaluateAll(es=>es.slice(0,2).map(e=>e.value));}
export async function activate(page,item){
 const list='https://sell.smartstore.naver.com/#/products/origin-list';
 const selectOnly=async()=>{
   const selected=page.getByRole('grid').getByRole('row').filter({has:page.locator('[aria-label="선택됨"]:not(.ag-hidden)')});
   for(const row of await selected.all())await row.locator('[col-id="checkbox"]').click();
   await page.getByRole('grid').getByRole('row').filter({hasText:item.id}).locator('[col-id="checkbox"]').click();
   const ids=await page.getByRole('grid').getByRole('row').evaluateAll(es=>es.filter(e=>e.querySelector('[aria-label="선택됨"]:not(.ag-hidden)')).map(e=>e.querySelector('[col-id="storefarmChannelProductNo"]')?.textContent.trim()));
   if(JSON.stringify(ids)!==JSON.stringify([item.id]))throw Error('선택 상품 검증 실패. 상태 변경 중단');
 };
 const change=async(menu,state)=>{
   await selectOnly();await page.getByText(menu,{exact:true}).first().click();await page.getByText(state,{exact:true}).last().click();
   await page.getByRole('dialog').getByRole('button',{name:'확인',exact:true}).click();
   const result=page.getByRole('dialog');await result.getByRole('heading',{name:'일괄변경 결과'}).waitFor();
   const text=await result.innerText();
   if(!text.includes(item.id)||!text.includes('변경되었습니다.'))throw Error('상태 변경 결과 확인 실패');
   await result.getByRole('button',{name:'Close',exact:true}).click();await page.reload();
 };
 await page.goto(list);let selling=await inventory(page,'판매중');
 if(!selling.some(p=>p.id===item.id)){
   const stopped=await inventory(page,'판매중지');
   if(!stopped.some(p=>p.id===item.id&&p.name===item.newName))throw Error('판매재개 대상 이름/상태 불일치');
   await change('판매변경','판매중');selling=await inventory(page,'판매중');
 }
 if(!selling.some(p=>p.id===item.id&&p.name===item.newName))throw Error('판매중 검증 실패');
 await openProduct(page,item.id);let displayed=await page.getByRole('radio',{name:'전시중',exact:true}).isChecked();
 await page.goto(list);
 if(!displayed){await inventory(page,'판매중');await change('전시변경','전시중');}
 await inventory(page,'판매중');await openProduct(page,item.id);
 if(!await page.getByRole('radio',{name:'전시중',exact:true}).isChecked())throw Error('전시중 검증 실패');
 await page.screenshot({path:resolve('logs',`${item.id}-${item.delivery}-active.png`)});
 await page.goto(list);
}
export async function edit(page,item){
 const otherFields=()=>page.locator('main input,main select,main textarea').evaluateAll(es=>es.filter(e=>e.name!=='period'&&e.title!=='날짜 입력'&&e.getAttribute('placeholder')!=='상품명 입력').map(e=>({id:e.id,name:e.name,type:e.type,value:e.value,checked:e.checked})).filter(e=>!e.value.includes('탄단지박스')));
 const baseline=JSON.stringify(await otherFields());
 if(await page.getByRole('textbox',{name:'상품명 입력',exact:true}).inputValue()!==item.oldName)throw Error('상품명 변경 감지. 중단');
 if(!await page.locator('#period1').isChecked())await page.locator('label[for="period1"]').click();
 await chooseDate(page,0,item.start,false);await chooseDate(page,1,item.end,true);
 await page.getByRole('textbox',{name:'상품명 입력',exact:true}).fill(item.newName);
 const expected=[item.start,item.end].map(v=>v.replaceAll('-','.').replace('T','. '));
 if(JSON.stringify(await fields(page))!==JSON.stringify(expected))throw Error('저장 전 판매기간 검증 실패');
 if(JSON.stringify(await otherFields())!==baseline)throw Error('허용 범위 외 입력값 변경 감지. 저장 중단');
 await page.getByRole('button',{name:'저장하기',exact:true}).first().click();
 await page.getByRole('dialog').getByText('상품수정이 완료되었습니다.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'상품관리',exact:true}).click();
 await page.reload();const all=await inventory(page,'전체');
 if(!all.some(p=>p.id===item.id&&p.name===item.newName))throw Error('저장 후 상품명 불일치. 사용자 확인 필요');
 await openProduct(page,item.id);
 if(JSON.stringify(await fields(page))!==JSON.stringify(expected))throw Error('저장 후 판매기간 불일치');
 await page.screenshot({path:resolve('logs',`${item.id}-${item.delivery}.png`)});
 await page.goto('https://sell.smartstore.naver.com/#/products/origin-list');
}
