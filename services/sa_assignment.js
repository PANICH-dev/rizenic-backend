const fail=message=>Object.assign(new Error(message),{status:400});
async function resolveAssignment(client,d){
 if(!Object.hasOwn(d,'sa_owner_employee_id')&&!Object.hasOwn(d,'sa_owner')&&!Object.hasOwn(d,'sa_collaborator_employee_ids'))return null;
 const rows=(await client.query('SELECT employee_id::text AS employee_id,employee_name,employee_role,branch_name,is_active FROM rizenicemployeemaster WHERE is_active=true')).rows;
 const available=rows.filter(e=>e.branch_name===(d.branch_name||'สำนักงานใหญ่')&&String(e.employee_role||'').toUpperCase().split(/[^A-Z0-9]+/).includes('SA'));
 const explicit=Object.hasOwn(d,'sa_owner_employee_id');
 const matches=available.filter(e=>explicit?typeof d.sa_owner_employee_id==='string'&&String(e.employee_id)===d.sa_owner_employee_id:e.employee_name===d.sa_owner);
 if(matches.length!==1)throw fail('กรุณาเลือก SA หลักจากรายชื่อที่เปิดใช้งานของสาขา');
 const primary=String(matches[0].employee_id),ids=d.sa_collaborator_employee_ids??[];
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!available.some(e=>String(e.employee_id)===id))||new Set(ids).size!==ids.length||ids.includes(primary))throw fail('ผู้รับผิดชอบร่วมไม่ถูกต้อง หรือเลือกซ้ำกัน');
 d.sa_owner=matches[0].employee_name;return{primary,ids:Object.hasOwn(d,'sa_collaborator_employee_ids')?ids:null};
}
async function saveAssignment(client,id,value){if(value)await client.query('UPDATE rizenicreport SET sa_owner_employee_id=$1,sa_collaborator_employee_ids=COALESCE($2::text[],sa_collaborator_employee_ids) WHERE id=$3',[value.primary,value.ids,id]);}
module.exports={resolveAssignment,saveAssignment};
