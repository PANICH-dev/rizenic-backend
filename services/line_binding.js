const {fail}=require('./tracking_context');
async function bindings(client,ids){return(await client.query('SELECT b.report_id,b.contact_id,c.display_name,c.is_active,c.branch FROM public.line_customer_bindings b JOIN public.line_customers c ON c.id=b.contact_id WHERE b.report_id=ANY($1::bigint[])',[ids])).rows;}
const contactIds=rows=>[...new Set(rows.map(r=>String(r.contact_id)))].sort();
async function bindContact(client,context,employee,contactId,expected=[]){
 await client.query('SELECT id FROM public.rizenicreport WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE',[context.ids]);const current=await bindings(client,context.ids);
 if(!Array.isArray(expected)||expected.some(v=>!/^\d+$/.test(String(v)))||contactIds(current).join(',')!==[...new Set(expected.map(String))].sort().join(','))throw fail('ผู้รับ LINE เปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนจับคู่',409,'RECIPIENT_CHANGED');
 if(contactId===null){await client.query('DELETE FROM public.line_customer_bindings WHERE report_id=ANY($1::bigint[])',[context.ids]);return null;}
 if(!['string','number'].includes(typeof contactId)||!/^[1-9]\d*$/.test(String(contactId)))throw fail('กรุณาเลือกลูกค้า LINE');const contact=(await client.query('SELECT id,branch,line_user_id,display_name,is_active FROM public.line_customers WHERE id=$1 FOR UPDATE',[contactId])).rows[0];if(!contact||contact.branch!==context.branch||!contact.is_active)throw fail('ผู้รับไม่พร้อมใช้งานหรืออยู่คนละสาขา',409,'INVALID_RECIPIENT');
 const inFlight=(await client.query("SELECT request_id FROM public.line_tracking_deliveries WHERE report_id=ANY($1::bigint[]) AND contact_id<>$2 AND status='sending' AND locked_until>CURRENT_TIMESTAMP LIMIT 1",[context.ids,contact.id])).rows;if(inFlight.length)throw fail('กำลังส่งข้อความให้ผู้รับเดิม กรุณารอสักครู่',409);
 await client.query('INSERT INTO public.line_customer_bindings(report_id,branch,contact_id,bound_by) SELECT unnest($1::bigint[]),$2,$3,$4 ON CONFLICT(report_id) DO UPDATE SET branch=EXCLUDED.branch,contact_id=EXCLUDED.contact_id,bound_by=EXCLUDED.bound_by,updated_at=CURRENT_TIMESTAMP',[context.ids,context.branch,contact.id,employee.employee_id]);return contact;
}
async function transaction(pool,work){const client=await pool.connect();try{await client.query('BEGIN');const value=await work(client);await client.query('COMMIT');return value;}catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}}
module.exports={bindings,contactIds,bindContact,transaction};
