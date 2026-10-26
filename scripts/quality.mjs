import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
export const commands={
 help:'Show commands',datasets:'Dataset owners and purposes',rules:'Quality rule inventory',
 'quality-week':'Weekly data quality review',attention:'Failures, overdue work and stale evidence',
 'check-results':'Recorded local and imported check outcomes','action-board':'Corrective actions',
 compliance:'Evidence checks supporting accuracy obligations',insights:'Ten operating questions',
 show:'Full dataset record and history',history:'Change history for a dataset',
 'add-dataset':'--code --name --owner --purpose --personal=yes|no --review-due=YYYY-MM-DD --max-age-hours=N --actor',
 'review-dataset':'<dataset> --owner --purpose --review-due --actor',
 'add-rule':'--dataset --code --name --kind --field --lower --upper --allowed=a,b --max-failures=N --severity=1|2|3 --actor',
 'set-rule':'<rule> --enabled=yes|no --actor',
 'check-file':'<dataset> <file.csv> --actor [--dry-run]',
 'add-action':'--dataset --code --name --owner --due=YYYY-MM-DD --actor',
 'close-action':'<action> --evidence --actor',
 'review-use':'<dataset> --evidence --actor',
 log:'<dataset> --note --actor',
 import:'dqops <results.json> --dataset --source=connection/schema/table --actor [--dry-run]',
 imports:'Imported result batches',export:'--out=<new-file.json>',
 'draft-quality-brief':'<dataset> creates a draft in drafts/',
 'weekly-review':'Draft from quality-week, attention and action-board'
};
export const insightQueries=[
 ['Which datasets have no recent local check?',"select dataset,finding from v_compliance where rule='STALE_CHECK'"],
 ['Which active rules changed after the latest run?',"select dataset,finding from v_compliance where rule='RULE_CHANGED'"],
 ['Which personal-data datasets lack use-review evidence?',"select * from v_attention where kind='USE_REVIEW'"],
 ['Which corrective actions are overdue?',"select * from v_attention where kind='ACTION_OVERDUE'"],
 ['Which owners have unresolved actions?',"select owner,count(*) as open_actions from actions where status='open' group by owner order by owner"],
 ['Which current rules fail in the latest extract?',"select * from v_checks where enabled and severity>0"],
 ['Which datasets contain history but no local test?',"select d.code,count(r.id) as imported_results from datasets d join results r on r.dataset_id=d.id and r.origin='dqops' where not exists(select 1 from batches b where b.dataset_id=d.id) group by d.code"],
 ['Which datasets need governance review?',"select code,owner,review_due from datasets where review_due<current_date"],
 ['Which datasets have no active quality rules?',"select dataset,finding from v_compliance where rule='NO_RULES'"],
 ['Which failed checks recur in recorded history?',"select d.code,r.check_name,count(*) as failures from results r join datasets d on d.id=r.dataset_id where r.severity>0 group by d.code,r.check_name having count(*)>1 order by failures desc"]
];
const sha=x=>createHash('sha256').update(x).digest('hex');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function parse(args){const opts={},pos=[];for(const a of args){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error('Duplicate option '+k);opts[k]=i<0?true:a.slice(i+1);}else pos.push(a);}return {opts,pos};}
const text=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error('Required '+label);return v.trim();};
const num=(v,label)=>{if(!['number','string'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v)))throw Error('Invalid numeric '+label);return Number(v);};
const integer=(v,label,min=0,max=100000000)=>{const n=num(v,label);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid integer '+label);return n;};
const bool=v=>{if(!['yes','no'].includes(v))throw Error('Use yes or no');return v==='yes';};
export function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Use a valid YYYY-MM-DD date');return v;}
export function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Timestamp needs a valid ISO time with timezone offset');date(v.slice(0,10));const [h,m,s]=v.slice(11,19).split(':').map(Number);if(h>23||m>59||s>59)throw Error('Invalid timestamp time');return new Date(v).toISOString();}
async function resolve(db,t,ref){text(ref,t+' reference');const rows=await db.query(`select * from ${t} where lower(code)=lower($1) or lower(name)=lower($1) order by code`,[ref]);if(rows.length===1)return rows[0];const candidates=rows.length?rows:await db.query(`select * from ${t} where id::text ilike $1 or name ilike $2 order by code`,[ref+'%','%'+ref+'%']);if(candidates.length!==1)throw Error((candidates.length?'Ambiguous':'No matching')+' '+t+': '+candidates.map(r=>r.code+' '+r.name+' '+r.id).join('; '));return candidates[0];}
async function event(db,id,actor,action,detail){await db.query('insert into events(subject_id,actor,action,detail) values($1,$2,$3,$4)',[id,actor,action,JSON.stringify(detail)]);}
async function transaction(db,work,dry=false){await db.exec('BEGIN');try{await db.exec('LOCK TABLE datasets IN SHARE ROW EXCLUSIVE MODE');const r=await work();await db.exec(dry?'ROLLBACK':'COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
function saveDraft(title,body){const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,title+'-'+randomUUID()+'.md');fs.writeFileSync(file,body,{flag:'wx',mode:0o600});return {file};}
function readable(x){if(!Array.isArray(x))return JSON.stringify(x,null,2);if(!x.length)return '(none)';return table(x,Object.keys(x[0]).map(key=>({key,label:key,width:80,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'')})));}
export function evaluate(rule,rows,now=new Date()){
 const values=rows.map(r=>r[rule.field]);
 if(rule.kind!=='row_count' && rows.length && !Object.hasOwn(rows[0],rule.field))throw Error('Missing CSV column '+rule.field);
 let actual,failed=0;
 const n=x=>String(x??'').trim()!==''&&Number.isFinite(Number(x))?Number(x):NaN;
 if(rule.kind==='row_count'){actual=rows.length;failed=(rule.lower_bound!==null&&actual<Number(rule.lower_bound)||rule.upper_bound!==null&&actual>Number(rule.upper_bound))?1:0;}
 if(rule.kind==='missing')failed=values.filter(v=>String(v??'').trim()==='').length;
 if(rule.kind==='duplicate'){const seen=new Set();for(const v of values){if(seen.has(v))failed++;seen.add(v);}}
 if(rule.kind==='number_range')failed=values.filter(v=>!Number.isFinite(n(v))||(rule.lower_bound!==null&&n(v)<Number(rule.lower_bound))||(rule.upper_bound!==null&&n(v)>Number(rule.upper_bound))).length;
 if(rule.kind==='allowed')failed=values.filter(v=>!rule.allowed.includes(v)).length;
 if(rule.kind==='freshness')failed=values.filter(v=>{try{const hours=(now-new Date(timestamp(v)))/3600000;return hours<0||hours>Number(rule.upper_bound);}catch{return true;}}).length;
 actual??=failed;
 return {actual_value:actual,failed_rows:failed,severity:failed>rule.max_failures?rule.severity:0};
}
const queries={datasets:'select code,name,owner,purpose,personal,review_due,max_age_hours from datasets order by code',rules:'select d.code as dataset,r.code,r.name,r.kind,r.field,r.lower_bound,r.upper_bound,r.allowed,r.max_failures,r.severity,r.enabled from rules r join datasets d on d.id=r.dataset_id order by r.code','quality-week':'select * from v_week order by code',attention:'select * from v_attention order by dataset,kind',compliance:'select dataset,rule,finding from v_compliance order by dataset,rule','check-results':'select d.code as dataset,r.check_name,r.origin,r.measured_at,r.actual_value,r.failed_rows,r.severity from results r join datasets d on d.id=r.dataset_id order by r.measured_at desc,r.id','action-board':'select a.code,d.code as dataset,a.name,a.owner,a.due,a.status,a.evidence from actions a join datasets d on d.id=a.dataset_id order by a.due,a.code',imports:'select d.code as dataset,i.source,i.added,i.skipped,i.created_at from imports i join datasets d on d.id=i.dataset_id order by i.created_at'};
const allTables=['datasets','rules','batches','results','actions','use_reviews','events','imports'];
export async function run(db,args){
 const {opts:o,pos:p}=parse(args),[cmd,...a]=p;
 if(!commands[cmd])throw Error('Unknown command. Use help.');
 const options={
 'add-dataset':['code','name','owner','purpose','personal','review-due','max-age-hours'],
 'review-dataset':['owner','purpose','review-due'],'add-rule':['dataset','code','name','kind','field','lower','upper','allowed','max-failures','severity'],
 'set-rule':['enabled'],'check-file':[],'add-action':['dataset','code','name','owner','due'],'close-action':['evidence'],'review-use':['evidence'],log:['note'],import:['dataset','source'],export:['out']
 };
 const writing=Object.hasOwn(options,cmd)&&cmd!=='export';
 const allowed=new Set(['json',...(options[cmd]||[]),...(writing?['actor','dry-run']:[])]);
 for(const key of Object.keys(o)){if(!allowed.has(key))throw Error('Unknown option --'+key);if(['json','dry-run'].includes(key)&&o[key]!==true)throw Error('--'+key+' takes no value');}
 const arity={show:1,history:1,'draft-quality-brief':1,'review-dataset':1,'set-rule':1,'check-file':2,'close-action':1,'review-use':1,log:1,import:2};
 if(a.length!==(arity[cmd]||0))throw Error('Wrong arguments. '+commands[cmd]);

 if(cmd==='help')return Object.entries(commands).map(([command,usage])=>({command,usage}));
 if(queries[cmd])return db.query(queries[cmd]);
 if(cmd==='insights'){const out=[];for(const [question,sql] of insightQueries)out.push({question,answer:await db.query(sql)});return out;}
 if(['show','history','draft-quality-brief'].includes(cmd)){
  const d=await resolve(db,'datasets',a[0]);const history=await db.query('select actor,action,detail,created_at from events where subject_id=$1 order by created_at,id',[d.id]);
  if(cmd==='history')return history;
  const record={dataset:d,rules:await db.query('select * from rules where dataset_id=$1 order by code',[d.id]),blockers:await db.query('select rule,finding from v_compliance where dataset_id=$1',[d.id]),actions:await db.query('select * from actions where dataset_id=$1 order by due',[d.id]),history};
  if(cmd==='show')return record;
  return saveDraft('quality-brief','# Data quality brief: '+d.name+'\n\nInternal review draft. Not a compliance certificate.\n\n'+JSON.stringify(record,null,2)+'\n');
 }
 if(cmd==='weekly-review'){let body='# Data quality weekly review\n\nInternal draft. Fictional demo records must be identified as demo.\n';for(const c of ['quality-week','attention','action-board'])body+='\n## '+c+'\n\n'+readable(await run(db,[c]))+'\n';return saveDraft('weekly-review',body);}
 if(cmd==='export'){
  const out=text(o.out,'--out');return transaction(db,async()=>{const records={};for(const t of allTables)records[t]=await db.query(`select * from ${t} order by id`);const file=path.resolve(out);fs.writeFileSync(file,JSON.stringify({format:'data-quality-v1',exported_at:new Date().toISOString(),records},null,2)+'\n',{flag:'wx',mode:0o600});return {file};});
 }
 const actor=text(o.actor,'--actor');
 return transaction(db,async()=>{
  let row;
  if(cmd==='add-dataset'){
   row=(await db.query('insert into datasets(code,name,owner,purpose,personal,review_due,max_age_hours) values($1,$2,$3,$4,$5,$6,$7) returning *',[text(o.code,'--code'),text(o.name,'--name'),text(o.owner,'--owner'),text(o.purpose,'--purpose'),bool(o.personal),date(o['review-due']),integer(o['max-age-hours']??24,'--max-age-hours',1,8760)]))[0];
  }else if(cmd==='review-dataset'){
   const d=await resolve(db,'datasets',a[0]);row=(await db.query('update datasets set owner=$2,purpose=$3,review_due=$4 where id=$1 returning *',[d.id,text(o.owner,'--owner'),text(o.purpose,'--purpose'),date(o['review-due'])]))[0];
  }else if(cmd==='add-rule'){
   const d=await resolve(db,'datasets',o.dataset),kind=text(o.kind,'--kind');
   if(!['row_count','missing','duplicate','number_range','allowed','freshness'].includes(kind))throw Error('Unknown rule kind');
   const lower=o.lower===undefined?null:num(o.lower,'--lower'),upper=o.upper===undefined?null:num(o.upper,'--upper');
   if(['row_count','number_range'].includes(kind)&&lower===null&&upper===null)throw Error('At least one bound required');
   if(kind==='freshness'&&(upper===null||upper<=0))throw Error('Freshness needs a positive --upper in hours');
   const allowed=kind==='allowed'?text(o.allowed,'--allowed').split(','):null;
   const field=kind==='row_count'?null:text(o.field,'--field');
   row=(await db.query('insert into rules(dataset_id,code,name,kind,field,lower_bound,upper_bound,allowed,max_failures,severity) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[d.id,text(o.code,'--code'),text(o.name,'--name'),kind,field,lower,upper,allowed?JSON.stringify(allowed):null,integer(o['max-failures']??0,'--max-failures'),integer(o.severity??2,'--severity',1,3)]))[0];
  }else if(cmd==='set-rule'){
   const r=await resolve(db,'rules',a[0]);row=(await db.query('update rules set enabled=$2 where id=$1 returning *',[r.id,bool(o.enabled)]))[0];
  }else if(cmd==='check-file'){
   const d=await resolve(db,'datasets',a[0]);await db.query('select id from datasets where id=$1 for update',[d.id]);
   const raw=fs.readFileSync(text(a[1],'CSV path'),'utf8'),rows=parseCsv(raw);
   if(!rows.length)throw Error('CSV has no data rows. No successful check is recorded.');
   const rules=(await db.query('select to_jsonb(r) as config from rules r where dataset_id=$1 and enabled order by code',[d.id])).map(x=>x.config);if(!rules.length)throw Error('No active rules');
   const checked=rules.map(r=>({r,...evaluate(r,rows)}));
   const b=(await db.query('insert into batches(dataset_id,source_name,sha256,row_count,actor) values($1,$2,$3,$4,$5) returning *',[d.id,path.basename(a[1]),sha(raw),rows.length,actor]))[0];
   for(const x of checked)await db.query("insert into results(dataset_id,rule_id,batch_id,check_name,origin,measured_at,actual_value,failed_rows,severity,rule_snapshot) values($1,$2,$3,$4,'local',now(),$5,$6,$7,$8)",[d.id,x.r.id,b.id,x.r.code,x.actual_value,x.failed_rows,x.severity,JSON.stringify(x.r)]);
   await event(db,d.id,actor,cmd,{batch:b.id,rows:rows.length,sha256:sha(raw)});
   return checked.map(x=>({dataset:d.code,rule:x.r.code,rows:rows.length,failed:x.failed_rows,severity:x.severity,batch:b.id}));
  }else if(cmd==='add-action'){
   const d=await resolve(db,'datasets',o.dataset);row=(await db.query('insert into actions(code,dataset_id,name,owner,due) values($1,$2,$3,$4,$5) returning *',[text(o.code,'--code'),d.id,text(o.name,'--name'),text(o.owner,'--owner'),date(o.due)]))[0];
  }else if(cmd==='close-action'){
   const x=await resolve(db,'actions',a[0]);if(x.status!=='open')throw Error('Action is already closed');row=(await db.query("update actions set status='closed',evidence=$2,closed_at=now() where id=$1 returning *",[x.id,text(o.evidence,'--evidence')]))[0];
  }else if(cmd==='review-use'){
   const d=await resolve(db,'datasets',a[0]);await db.query('select id from datasets where id=$1 for update',[d.id]);
   const blockers=await db.query('select rule,finding from v_compliance where dataset_id=$1',[d.id]);if(blockers.length)throw Error('Review blocked: '+blockers.map(x=>x.rule+': '+x.finding).join('; '));
   const b=(await db.query('select * from v_latest_batch where dataset_id=$1',[d.id]))[0];
   row=(await db.query('insert into use_reviews(dataset_id,batch_id,reviewer,purpose,evidence,expires_at) values($1,$2,$3,$4,$5,$6::timestamptz+make_interval(hours=>$7)) returning *',[d.id,b.id,actor,d.purpose,text(o.evidence,'--evidence'),b.created_at,d.max_age_hours]))[0];
  }else if(cmd==='log'){
   const d=await resolve(db,'datasets',a[0]);await event(db,d.id,actor,'note',{note:text(o.note,'--note')});return {dataset:d.code,logged:true};
  }else if(cmd==='import'){
   if(a[0]!=='dqops')throw Error('Only import dqops is supported');
   const d=await resolve(db,'datasets',o.dataset),source=text(o.source,'--source');const raw=fs.readFileSync(text(a[1],'JSON path'),'utf8'),groups=JSON.parse(raw);
   if(!Array.isArray(groups)||!groups.length)throw Error('Expected a nonempty DQOps result list');
   let added=0,skipped=0;const keys=new Set();
   for(const g of groups){if(!Array.isArray(g.checkResultEntries)||!g.checkResultEntries.length)throw Error('Expected checkResultEntries');
    for(const entry of g.checkResultEntries){
     if(typeof entry.id!=='string'||!entry.id.trim())throw Error('DQOps id must be a nonempty string to preserve precision');
     const key=stable([source,entry.id]),hash=sha(stable({group:Object.fromEntries(Object.entries(g).filter(([k])=>k!=='checkResultEntries')),entry}));
     if(keys.has(key))throw Error('Duplicate result id in source file');keys.add(key);
     const old=await db.query('select dataset_id,source_hash from results where source_key=$1',[key]);
     if(old.length){if(old[0].source_hash!==hash||old[0].dataset_id!==d.id)throw Error('Changed source result or dataset mapping for '+entry.id);skipped++;continue;}
     const severity=integer(entry.severity,'source severity',0,4),measured=timestamp(entry.executedAt);
     if(new Date(measured)>new Date())throw Error('Future source result timestamp');
     const value=entry.actualValue==null?null:num(entry.actualValue,'actualValue');
     await db.query("insert into results(dataset_id,check_name,origin,measured_at,actual_value,severity,source_key,source_hash,source_row) values($1,$2,'dqops',$3,$4,$5,$6,$7,$8)",[d.id,text(entry.checkName||g.checkName,'checkName'),measured,value,severity,key,hash,JSON.stringify({group:Object.fromEntries(Object.entries(g).filter(([k])=>k!=='checkResultEntries')),entry})]);added++;
    }
   }
   await db.query('insert into imports(dataset_id,source,sha256,added,skipped,actor) values($1,$2,$3,$4,$5,$6)',[d.id,source,sha(raw),added,skipped,actor]);await event(db,d.id,actor,cmd,{source,sha256:sha(raw),added,skipped});return {dataset:d.code,added,skipped,dry_run:!!o['dry-run']};
  }
  if(!row)throw Error('Unhandled command '+cmd);
  await event(db,row.dataset_id||row.id,actor,cmd,row);return row;
 },!!o['dry-run']);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):readable(result));}catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=1;}finally{if(db)await db.close();}
}
