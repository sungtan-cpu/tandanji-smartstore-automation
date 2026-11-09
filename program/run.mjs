import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planWindow,korea,dateText} from './core.mjs';
import {connect,inventory,openProduct,edit,activate} from './browser.mjs';
import {sortHome} from './home-sort.mjs';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
await fs.mkdir('logs',{recursive:true});
const config=JSON.parse(await fs.readFile('config.json','utf8'));
const calendar=JSON.parse(await fs.readFile('holiday-calendar.json','utf8'));
const mode=process.argv[2]||'preview';
function runPlan(products){return planWindow(products,new Date(),calendar);}
async function productStates(page){const all=await inventory(page);const stopped=await inventory(page,'판매중지');const ended=await inventory(page,'판매종료');const a=new Set(stopped.map(p=>p.id));const b=new Set(ended.map(p=>p.id));return all.map(p=>({...p,status:a.has(p.id)?'판매중지':b.has(p.id)?'판매종료':'기타'}));}
async function notify(text){const url=process.env[config.chatWebhookEnv];if(!url)return;const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='chat.googleapis.com')throw Error('구글 챗 웹훅 주소 확인 필요');const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});if(!r.ok)throw Error('챗 알림 실패: '+r.status);}
async function execute(actual=false){
 let lock;try{lock=await fs.open('run.lock','wx');}catch{throw Error('다른 실행 중 또는 이전 비정상 종료. run.lock 확인 필요');}
 let context;
 const stamp=new Date().toISOString().replaceAll(':','-');
 const log=async value=>fs.appendFile('logs/history.jsonl',JSON.stringify({run:stamp,time:new Date().toISOString(),...value})+'\n');
 try{
   if(actual&&!config.previewApproved)throw Error('최초 미리보기 확인 후 config.json의 previewApproved를 true로 바꾸세요.');
   if(config.startPolicy!=='current-hour')throw Error('현재 UI는 시작 정각만 지원합니다. startPolicy를 확인하세요.');
   const session=await connect();context=session.context;const page=session.page;
   const products=await productStates(page);
   const items=runPlan(products);console.table(items);
   await fs.writeFile(`logs/preview-${stamp}.json`,JSON.stringify(items,null,2));
   if(!actual){await log({event:'preview',items});await sortHome(page,{preview:true,year:korea().getUTCFullYear(),log});console.log('상품 변경과 현재 홈 정렬 미리보기 완료. 저장하지 않았습니다.');return;}
   for(const item of items){
     if(item.skip){await log({event:'name-period-skip',...item});await activate(page,item);await log({event:'active-verified',...item,status:'판매중',display:'전시중'});continue;}
     // 각 저장 직전에 전체 판매상태를 재조회하여 중복 및 동시 변경을 확인한다.
     const freshProducts=await productStates(page);
     const fresh=runPlan(freshProducts).find(p=>p.kind===item.kind&&p.delivery===item.delivery);
     if(!fresh)throw Error('실행 중 배송일 범위가 변경되었습니다. 다시 미리보기 필요');
     if(fresh.skip){await activate(page,fresh);await log({event:'active-verified',...fresh,status:'판매중',display:'전시중'});continue;}
     if(fresh.id!==item.id||fresh.oldName!==item.oldName||fresh.delivery!==item.delivery)throw Error('대상 또는 배송일 변경 감지. 다시 미리보기 필요');
     await inventory(page,'전체');await openProduct(page,item.id);
     const now=korea();item.start=now.toISOString().slice(0,13)+':00';
     await log({event:'pending',...item});await edit(page,item);await log({event:'verified',...item,status:'판매중지'});await activate(page,item);await log({event:'active-verified',...item,status:'판매중',display:'전시중'});
   }
   await sortHome(page,{year:korea().getUTCFullYear(),log});
   await notify('스마트스토어 처리 완료: 판매중·전시중 및 홈 배송일순 정렬 검증 완료. '+items.map(p=>p.kind+': '+p.newName).join('\n'));
 }catch(e){await log({event:'error',message:e.message});try{await notify('스마트스토어 자동화 확인 필요: '+e.message);}catch{}throw e;}
 finally{if(context)await context.close();await lock.close();await fs.unlink('run.lock');}
}
if(mode==='schedule'){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.time))throw Error('예약 시각은 HH:mm 형식이어야 합니다.');
 console.log(`월·목 ${config.time} 한국시간 예약 대기 (${config.scheduledMode}). 이 창과 PC를 켜 두세요.`);
 const tick=async()=>{const d=korea();if(![1,4].includes(d.getUTCDay())||d.toISOString().slice(11,16)!==config.time)return;const key=dateText(d);let done={};try{done=JSON.parse(await fs.readFile('schedule-state.json','utf8'));}catch{}if(done[key])return;done[key]='attempted';await fs.writeFile('schedule-state.json',JSON.stringify(done));try{await execute(config.scheduledMode==='apply');}catch(e){console.error(e.message);}};
 await tick();setInterval(()=>tick().catch(e=>console.error(e.message)),20000);
}else if(['preview','apply'].includes(mode)){try{await execute(mode==='apply');}catch(e){console.error(e.message);process.exitCode=1;}}
else throw Error('preview / apply / schedule 중 선택하세요.');
