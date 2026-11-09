export const KINDS=['고단백도시락','웜프 샐러드'];
const DAY=86400000;
export function korea(now=new Date()){return new Date(now.getTime()+9*3600000);}
export function dateText(d){return d.toISOString().slice(0,10);}
export function delivery(now=new Date()){
 const d=korea(now); d.setUTCHours(0,0,0,0); let n=0;
 while(n<4){d.setTime(d.getTime()+DAY);if([1,4].includes(d.getUTCDay()))n++;}
 return d;
}
export function round(d,holidays=[]){let n=0;for(let i=1;i<=d.getUTCDate();i++){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),i));if([1,4].includes(x.getUTCDay())&&!holidays.includes(dateText(x)))n++;}return n;}
export function newName(kind,d,calendar=null){return `${String(d.getUTCMonth()+1).padStart(2,'0')}월${String(d.getUTCDate()).padStart(2,'0')}일(${'일월화수목금토'[d.getUTCDay()]}) [${kind}] 탄단지박스 ${d.getUTCMonth()+1}월 ${round(d,calendar?.holidays||[])}회차`;}
export function parse(name,year){
 const m=name.match(/^(\d{1,2})월\s*(\d{1,2})일\(([월목])\)\s*\[(고단백도시락|웜프 샐러드)\]\s*탄단지박스\s*(\d{1,2})월\s*(\d+)회차$/);
 if(!m)return null;
 const d=new Date(Date.UTC(year,+m[1]-1,+m[2]));
 if(d.getUTCMonth()!==+m[1]-1||d.getUTCDate()!==+m[2]||+m[1]!==+m[5]||'일월화수목금토'[d.getUTCDay()]!==m[3]||+m[6]<1)throw Error(`날짜·회차 해석 실패: ${name}`);
 return {kind:m[4],date:d};
}
export function plan(products,now=new Date(),overrideDate=null){
 const today=korea(now);today.setUTCHours(0,0,0,0); const target=overrideDate?new Date(overrideDate+'T00:00:00Z'):delivery(now);
 if(!Number.isFinite(target.getTime())||target<=today||![1,4].includes(target.getUTCDay()))throw Error('배송일 지정값은 실행일 이후 월·목이어야 합니다.');
 const end=new Date(target.getTime()-3*DAY);
 return KINDS.map(kind=>{
   const duplicate=products.find(p=>{if(!p.name.includes(`[${kind}]`))return false;const m=p.name.match(/^(\d+)월\s*(\d+)일/);return m&&+m[1]===target.getUTCMonth()+1&&+m[2]===target.getUTCDate();});
   if(duplicate)return {kind,skip:true,reason:'동일 배송일 상품 존재',id:duplicate.id,newName:newName(kind,target),delivery:dateText(target),end:dateText(end)+'T23:59',finalStatus:'판매중',finalDisplay:'전시중'};
   const candidates=[];
   for(const p of products.filter(p=>['판매중지','판매종료'].includes(p.status)&&p.name.includes(`[${kind}]`)&&p.name.includes('탄단지박스'))){
     const x=parse(p.name,today.getUTCFullYear());
     if(!x)throw Error(`대상 상품명 해석 실패: ${p.id} ${p.name}`);
     if(x.date<today)candidates.push({...p,date:x.date});
   }
   candidates.sort((a,b)=>b.date-a.date);
   if(!candidates.length)throw Error(`과거 판매중지/판매종료 상품 없음: ${kind}`);
   if(candidates[1]?.date.getTime()===candidates[0].date.getTime())throw Error(`최신 배송일 중복으로 대상이 모호함: ${kind}`);
   const p=candidates[0];return {kind,id:p.id,oldName:p.name,newName:newName(kind,target),delivery:dateText(target),start:korea(now).toISOString().slice(0,13)+':00',end:dateText(end)+'T23:59'};
 });
}
export function assertNoEarlierGaps(products,target,now=new Date()){
 const d=korea(now);d.setUTCHours(0,0,0,0);
 while(true){d.setTime(d.getTime()+DAY);if(dateText(d)>=target)return;if(![1,4].includes(d.getUTCDay()))continue;
 for(const kind of KINDS){if(!products.some(p=>{const m=p.name.match(/^(\d+)월\s*(\d+)일/);return m&&+m[1]===d.getUTCMonth()+1&&+m[2]===d.getUTCDate()&&p.name.includes('['+kind+']');}))throw Error(`앞선 배송일 누락: ${dateText(d)} ${kind}. 뒤 날짜를 저장하지 않고 중단합니다. 누락일 보완이 먼저 필요합니다.`);}}
}
export function eligibleWindow(now,calendar,count=4){
 const d=korea(now);d.setUTCHours(0,0,0,0);const today=dateText(d);
 if(today<calendar.checkedOn||(d-new Date(calendar.checkedOn+'T00:00:00Z'))/DAY>calendar.maxAgeDays)throw Error('대한민국 공휴일 자료가 오래됐습니다. 공휴일·대체공휴일·임시공휴일 재확인 후 checkedOn을 갱신하세요.');
 const result=[];
 while(result.length<count){d.setTime(d.getTime()+DAY);const iso=dateText(d);if(iso<calendar.coverageStart||iso>calendar.coverageEnd)throw Error('공휴일 자료의 확인 범위 밖입니다: '+iso);if([1,4].includes(d.getUTCDay())&&!calendar.holidays.includes(iso))result.push(iso);}
 return result;
}
export function planWindow(products,now,calendar){
 const window=eligibleWindow(now,calendar);const working=products.map(p=>({...p}));const result=[];
 for(const day of window){if(day.slice(0,7)+'-01'<calendar.coverageStart)throw Error('배송월 회차 계산에 필요한 공휴일 범위가 부족합니다.');const pair=plan(working,now,day);for(const item of pair){item.newName=newName(item.kind,new Date(day+'T00:00:00Z'),calendar);result.push(item);if(!item.skip){const p=working.find(p=>p.id===item.id);p.name=item.newName;p.status='계획중';}}}
 return result;
}
