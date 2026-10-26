import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {run} from './quality.mjs';
export async function seed(db){
 if(db.mode!=='pglite'&&process.env.TEST_DATABASE_URL!==process.env.DATABASE_URL)throw Error('Seed requires embedded or explicit disposable test database');
 await db.exec('BEGIN');try{await db.exec(fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}
 for(const code of ['CONTACTS','ORDERS']){
  const exists=await db.query('select b.id from batches b join datasets d on d.id=b.dataset_id where d.code=$1',[code]);
  if(!exists.length)await run(db,['check-file',code,path.join(REPO_ROOT,'examples',code.toLowerCase()+'.csv'),'--actor=Fictional demo']);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const db=await getDb();try{await seed(db);console.log('seed: fictional data quality desk ready');}finally{await db.close();}}
