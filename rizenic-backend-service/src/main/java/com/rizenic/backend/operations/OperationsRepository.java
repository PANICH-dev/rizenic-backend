package com.rizenic.backend.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.*;

@Repository
public class OperationsRepository {
    private final JdbcClient db;
    private final ObjectMapper json = new ObjectMapper();
    public OperationsRepository(JdbcClient db) { this.db = db; }

    private Long branch(Object value) {
        if (value != null && !value.toString().isBlank()) {
            var found = db.sql("select id from rizenic_new.branches where is_active=true and (lower(name)=lower(:v) or lower(code)=lower(:v)) limit 1")
                    .param("v", value.toString().trim()).query(Long.class).optional();
            if (found.isPresent()) return found.get();
        }
        return db.sql("select id from rizenic_new.branches where is_active=true order by id limit 1").query(Long.class).single();
    }

    private String json(Object value) {
        try { return json.writeValueAsString(value == null ? Map.of() : value); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("JSON ไม่ถูกต้อง", e); }
    }

    private Object parseJson(Object value) {
        if (value == null) return Map.of();
        String str = value.toString();
        try {
            var method = value.getClass().getMethod("getValue");
            Object res = method.invoke(value);
            if (res != null) str = res.toString();
        } catch (Exception ignored) {}
        if (str == null || str.isBlank()) return Map.of();
        try {
            Object parsed = json.readValue(str, Object.class);
            if (parsed instanceof Map<?,?> map) return map;
            return Map.of();
        } catch (Exception e) { return Map.of(); }
    }

    public Optional<LinkedHashMap<String,Object>> inspection(Long jobId) {
        return db.sql("""
                select i.id, i.job_id, i.vehicle_id, b.name branch_name,
                       i.fuel_percent fuel_level, i.mileage current_mileage,
                       i.job_type, i.job_category, i.repair_checklist,
                       i.inventory_checklist, i.electrical_checklist, i.notes,
                       i.inspected_at, i.created_at,
                       v.plate_number car_plate,
                       max(case when ia.purpose='CAR_DIAGRAM' then a.storage_key end) car_diagram_image,
                       max(case when ia.purpose='CUSTOMER_INTAKE_SIGNATURE' then a.storage_key end) customer_signature,
                       max(case when ia.purpose='INSPECTOR_INTAKE_SIGNATURE' then a.storage_key end) inspector_signature
                from rizenic_new.inspections i
                join rizenic_new.branches b on b.id=i.branch_id
                left join rizenic_new.vehicles v on v.id=i.vehicle_id
                left join rizenic_new.inspection_attachments ia on ia.inspection_id=i.id
                left join rizenic_new.attachments a on a.id=ia.attachment_id
                where i.job_id=:job
                group by i.id,b.name,v.plate_number
                order by i.id desc limit 1
                """).param("job", jobId).query((r,n) -> {
            var m = new LinkedHashMap<String,Object>();
            for (var k : List.of("id","job_id","vehicle_id","branch_name","fuel_level","current_mileage","job_type","job_category","repair_checklist","inventory_checklist","electrical_checklist","notes","inspected_at","created_at","car_plate","car_diagram_image","customer_signature","inspector_signature")) {
                if (k.endsWith("_checklist")) {
                    m.put(k, parseJson(r.getObject(k)));
                } else {
                    m.put(k, r.getObject(k));
                }
            }
            return m;
        }).optional();
    }

    public Optional<LinkedHashMap<String,Object>> inspectionByReference(String reference) {
        Long jobId = resolveJobReference(reference);
        return jobId == null ? Optional.empty() : inspection(jobId);
    }

    private Long resolveJobReference(String reference) {
        return db.sql("""
                select j.id
                from rizenic_new.repair_jobs j
                left join rizenic_new.vehicles v on v.id=j.vehicle_id
                where j.job_number=:legacy
                   or lower(btrim(v.plate_number))=lower(btrim(:reference))
                   or j.id=case when :reference ~ '^[0-9]+$' then cast(:reference as bigint) else null end
                order by case when j.job_number=:legacy then 0
                              when lower(btrim(v.plate_number))=lower(btrim(:reference)) then 1 else 2 end, j.id
                limit 1
                """)
                .param("legacy", "LEGACY-" + reference)
                .param("reference", reference)
                .query(Long.class).optional().orElse(null);
    }

    public Map<String,Object> saveInspection(Map<String,Object> x, Long inspectorId) {
        Long jobId = number(x.get("job_id"));
        if (jobId != null) jobId = resolveJobReference(String.valueOf(jobId));
        Long vehicleId = number(x.get("vehicle_id"));
        if (vehicleId == null && jobId != null) vehicleId = db.sql("select vehicle_id from rizenic_new.repair_jobs where id=:j").param("j",jobId).query(Long.class).optional().orElse(null);
        Long branchId = branch(x.get("branch_name"));
        if (jobId != null) branchId = db.sql("select branch_id from rizenic_new.repair_jobs where id=:j").param("j",jobId).query(Long.class).optional().orElse(branchId);
        String type = String.valueOf(x.getOrDefault("inspection_type", "LEGACY")).toUpperCase(Locale.ROOT);
        if (!Set.of("INTAKE","DELIVERY","OTHER","LEGACY").contains(type)) type = "LEGACY";
        Long id = db.sql("""
                insert into rizenic_new.inspections(branch_id,job_id,vehicle_id,inspection_type,fuel_percent,mileage,job_type,job_category,repair_checklist,inventory_checklist,electrical_checklist,inspector_id,inspected_at,notes)
                values(:b,:j,:v,:t,:fuel,:mileage,:jt,:jc,cast(:repair as jsonb),cast(:inventory as jsonb),cast(:electrical as jsonb),:inspector,now(),:notes) returning id
                """).param("b",branchId).param("j",jobId).param("v",vehicleId).param("t",type)
                .param("fuel", decimal(x.get("fuel_level"))).param("mileage", decimal(x.get("current_mileage")))
                .param("jt", x.get("job_type")).param("jc", x.get("job_category"))
                .param("repair", json(x.get("repair_checklist"))).param("inventory", json(x.get("inventory_checklist"))).param("electrical", json(x.get("electrical_checklist")))
                .param("inspector", inspectorId).param("notes", x.get("notes")).query(Long.class).single();
        attach(id, "CAR_DIAGRAM", x.get("car_diagram_image"));
        attach(id, "CUSTOMER_INTAKE_SIGNATURE", x.get("customer_signature"));
        attach(id, "INSPECTOR_INTAKE_SIGNATURE", x.get("inspector_signature"));
        final Long resolvedJobId = jobId;
        return inspection(resolvedJobId).map(v -> (Map<String,Object>)v).orElseGet(() -> { var m=new LinkedHashMap<String,Object>(); m.put("id",id); m.put("job_id",resolvedJobId); return m; });
    }

    private void attach(Long inspectionId, String purpose, Object raw) {
        if (raw == null || raw.toString().isBlank()) return;
        String storage = raw.toString();
        String media = "application/octet-stream";
        if (storage.startsWith("data:")) { int comma=storage.indexOf(','); String meta=storage.substring(5,comma); media=meta.split(";",2)[0]; storage=storage.substring(comma+1); }
        String key = UUID.randomUUID().toString();
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(storage); } catch (IllegalArgumentException e) { bytes = raw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8); }
        try { var dir=java.nio.file.Paths.get(System.getenv().getOrDefault("ATTACHMENT_STORAGE_PATH", "./data/attachments")); java.nio.file.Files.createDirectories(dir); java.nio.file.Files.write(dir.resolve(key), bytes); }
        catch (java.io.IOException e) { throw new IllegalStateException("ไม่สามารถจัดเก็บไฟล์ตรวจสภาพรถ", e); }
        String sha;
        try { sha = hex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable", e); }
        db.sql("insert into rizenic_new.attachments(storage_key,original_filename,media_type,byte_size,sha256) values(:k,:f,:m,:s,:h) returning id")
                .param("k",key).param("f",purpose.toLowerCase(Locale.ROOT)).param("m",media).param("s",(long)bytes.length).param("h",sha)
                .query(Long.class).single();
        Long aid = db.sql("select id from rizenic_new.attachments where storage_key=:k").param("k",key).query(Long.class).single();
        db.sql("insert into rizenic_new.inspection_attachments(inspection_id,attachment_id,purpose) values(:i,:a,:p)").param("i",inspectionId).param("a",aid).param("p",purpose).update();
    }
    private static String hex(byte[] b){var s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x));return s.toString();}
    private static Long number(Object v){if(v==null||v.toString().isBlank())return null;return Long.valueOf(v.toString());}
    private static Object decimal(Object v){if(v==null||v.toString().isBlank())return null;return new java.math.BigDecimal(v.toString());}

    public List<LinkedHashMap<String,Object>> quotas() {
        return db.sql("""
                select min(r.id) id, case when r.rule_date is null then 'default' else 'special' end quota_type,
                       r.rule_date quota_date, b.name branch_name,
                       coalesce(max(r.capacity_limit) filter (where r.metric='INTAKE_CARS'),0) quota_arrived,
                       coalesce(max(r.capacity_limit) filter (where r.metric='TARGET_CARS'),0) quota_target,
                       coalesce(max(r.capacity_limit) filter (where r.metric='DELIVERY_CARS'),0) quota_delivery,
                       coalesce(max(r.capacity_limit) filter (where r.metric='COLOR_PARTS'),0) quota_color_parts,
                       coalesce(max(r.capacity_limit) filter (where r.metric='MAIN_PARTS'),0) quota_main_parts,
                       coalesce(max(r.capacity_limit) filter (where r.metric='SUB_PARTS'),0) quota_sub_parts
                from rizenic_new.branch_capacity_rules r join rizenic_new.branches b on b.id=r.branch_id
                group by b.name,r.rule_date order by quota_type,quota_date desc nulls last,min(r.id)
                """).query((r,n)->{var m=new LinkedHashMap<String,Object>();for(var k:List.of("id","quota_type","quota_date","branch_name","quota_arrived","quota_target","quota_delivery","quota_color_parts","quota_main_parts","quota_sub_parts"))m.put(k,r.getObject(k));return m;}).list();
    }

    public Map<String,Object> saveQuota(Long id, Map<String,Object> x) {
        Long b=branch(x.get("branch_name")); LocalDate date = x.get("quota_date")==null||x.get("quota_date").toString().isBlank()?null:LocalDate.parse(x.get("quota_date").toString());
        if(id!=null) db.sql("delete from rizenic_new.branch_capacity_rules where id=:id or (branch_id=:b and rule_date is not distinct from :d)").param("id",id).param("b",b).param("d",date).update();
        for(var metric: List.of("INTAKE_CARS","TARGET_CARS","DELIVERY_CARS","COLOR_PARTS","MAIN_PARTS","SUB_PARTS")) db.sql("insert into rizenic_new.branch_capacity_rules(branch_id,metric,rule_date,capacity_limit) values(:b,:m,:d,:v) on conflict (branch_id,metric,rule_date) do update set capacity_limit=excluded.capacity_limit,updated_at=now()").param("b",b).param("m",metric).param("d",date).param("v",quotaValue(x,metric)).update();
        return Map.of("success",true);
    }
    private int quotaValue(Map<String,Object>x,String metric){String k=switch(metric){case "INTAKE_CARS"->"quota_arrived";case "TARGET_CARS"->"quota_target";case "DELIVERY_CARS"->"quota_delivery";case "COLOR_PARTS"->"quota_color_parts";case "MAIN_PARTS"->"quota_main_parts";default->"quota_sub_parts";};try{return Integer.parseInt(String.valueOf(x.getOrDefault(k,0)));}catch(Exception e){return 0;}}
    public void deleteQuota(Long id){db.sql("delete from rizenic_new.branch_capacity_rules where id=:id").param("id",id).update();}

    public LinkedHashMap<String,Object> preferences(String emp) {
        return db.sql("select up.settings from rizenic_new.user_preferences up join rizenic_new.user_accounts ua on ua.id=up.user_id join rizenic_new.employees e on e.id=ua.employee_id where (e.employee_code=:e or lower(e.display_name)=lower(:e) or lower(ua.username)=lower(:e)) and up.page_key='legacy' limit 1").param("e",emp).query((r,n)->{
            var out=new LinkedHashMap<String,Object>(); Object raw=r.getObject("settings");
            try { var node=json.readTree(String.valueOf(raw)); out.put("hidden_columns", node.has("hidden_columns") ? json.convertValue(node.get("hidden_columns"),Object.class) : null); out.put("row_highlights", node.has("row_highlights") ? json.convertValue(node.get("row_highlights"),Object.class) : null); }
            catch(Exception ignored){ out.put("hidden_columns",null); out.put("row_highlights",null); }
            return out;
        }).optional().orElseGet(()->{var m=new LinkedHashMap<String,Object>();m.put("hidden_columns",null);m.put("row_highlights",null);return m;});
    }
    public void savePreferences(Map<String,Object>x){String emp=String.valueOf(x.get("emp_name"));Long user=db.sql("select ua.id from rizenic_new.user_accounts ua join rizenic_new.employees e on e.id=ua.employee_id where e.employee_code=:e or lower(e.display_name)=lower(:e) or lower(ua.username)=lower(:e) limit 1").param("e",emp).query(Long.class).optional().orElseThrow(()->new IllegalArgumentException("ไม่พบบัญชีพนักงาน: "+emp));Map<String,Object> settings=new LinkedHashMap<>();settings.put("hidden_columns",x.getOrDefault("hidden_columns",Map.of("hidden",List.of(),"order",List.of())));settings.put("row_highlights",x.getOrDefault("row_highlights",Map.of()));db.sql("insert into rizenic_new.user_preferences(user_id,page_key,settings,updated_at) values(:u,'legacy',cast(:s as jsonb),now()) on conflict(user_id,page_key) do update set settings=excluded.settings,updated_at=now()").param("u",user).param("s",json(settings)).update();}
}
