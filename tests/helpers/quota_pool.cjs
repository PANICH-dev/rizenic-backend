// Transactional in-memory fixture for quota tests. Models the shared advisory lock and rollback.
function quotaPool(initial=[],quotas=[]){
 const jobs=new Map(initial.map(row=>[String(row.id),{...row}]));let tail=Promise.resolve(),nextId=Math.max(0,...initial.map(row=>+row.id))+1;const calls=[];
 const acquire=async()=>{const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;return release;};
 const date=value=>value?String(value).slice(0,10):null;
 async function connect(){
  const staged=new Map();let unlock=null;
  const rows=()=>new Map([...jobs,...staged]);
  const client={release(){if(unlock){unlock();unlock=null;}},async query(sql,params=[]){
   calls.push({sql,params});
   if(sql==='BEGIN')return{rows:[]};
   if(sql==='COMMIT'){for(const [id,row]of staged)jobs.set(id,row);client.release();return{rows:[]};}
   if(sql==='ROLLBACK'){staged.clear();client.release();return{rows:[]};}
   if(sql.includes('pg_advisory_xact_lock')){unlock=await acquire();return{rows:[]};}
   if(sql.startsWith('SELECT id,branch_name')){const row=rows().get(String(params[0]));return{rows:row?[{...row}]:[]};}
   if(sql.startsWith('SELECT * FROM rizenic_quotas'))return{rows:quotas.filter(q=>q.branch_name===params[0]).sort((a,b)=>b.id-a.id)};
   if(sql.includes('COUNT(*) FILTER')){
    const [branch,day,exclude]=params,result={arrived:0,target:0,delivery:0,main:0,sub:0};
    for(const job of rows().values()){if(job.branch_name!==branch||String(job.id)===String(exclude))continue;if(date(job.arrived_date)===day)result.arrived++;if(date(job.target_finish_date)===day){result.target++;result.main+=Number(job.main_part_qty)||0;result.sub+=Number(job.sub_part_qty)||0;}if(date(job.delivery_date)===day)result.delivery++;}return{rows:[result]};
   }
   if(sql.startsWith('SELECT id FROM rizenicreport')){const row=rows().get(String(params[0]));return{rows:sql.includes('"id"')&&row?[{id:row.id}]:[]};}
   if(sql.startsWith('SELECT customer_source'))return{rows:[{customer_source:rows().get(String(params[0]))?.customer_source}]};
   if(sql.startsWith('INSERT INTO rizenicreport')||sql.startsWith('INSERT INTO public."rizenicreport"')){
    const columns=sql.slice(sql.indexOf('(')+1,sql.indexOf(')')).split(',').map(x=>x.trim().replaceAll('"',''));
    const record=Object.fromEntries(columns.map((key,index)=>[key,params[index]]));const id=String(record.id??nextId++);record.id=Number(id);staged.set(id,{...rows().get(id),...record});return{rows:[{id:Number(id)}],rowCount:1};
   }
   if(sql.startsWith('UPDATE rizenicreport SET')){
    const idMatch=sql.match(/WHERE id\s*=\s*\$(\d+)/);const id=String(params[+idMatch[1]-1]),row={...rows().get(id)};
    for(const match of sql.matchAll(/([a-z_]+)\s*=\s*(?:COALESCE\()?\$(\d+)/gi)){const value=params[+match[2]-1];if(sql.slice(match.index,match.index+match[0].length).includes('COALESCE')&&value==null)continue;row[match[1]]=value;}
    staged.set(id,row);return{rows:[],rowCount:1};
   }
   if(sql.startsWith('SELECT department'))return{rows:[]};
   if(sql.startsWith('SELECT id FROM customer_sources'))return{rows:[{id:1}]};
   throw Error('Unexpected fixture SQL: '+sql.slice(0,90));
  },save(row){staged.set(String(row.id),{...row});}};return client;
 }
 return{jobs,calls,quotas,connect,async query(sql,params=[]){const client=await connect();try{return await client.query(sql,params);}finally{client.release();}}};
}
module.exports={quotaPool};
