package com.rizenic.backend.integration;

import com.rizenic.backend.infrastructure.AuditEventService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class DynamicSyncService {
    private final JdbcClient db; private final AuditEventService audit;
    private static final Map<String,String> TABLES=Map.of("parts","parts","customer_types","customer_types","car_models","car_models","car_brands","car_brands","body_parts","body_parts","job_statuses","job_statuses","insurers","insurers");
    public DynamicSyncService(JdbcClient db, AuditEventService audit){this.db=db;this.audit=audit;}
    @Transactional public Map<String,Object> sync(Map<String,Object> request){
        String requested=String.valueOf(request.getOrDefault("tableName","")); String table=TABLES.get(requested); Object raw=request.get("data");
        if(table==null || !(raw instanceof List<?> rows) || rows.isEmpty()) throw new IllegalArgumentException("ข้อมูล sync ไม่ถูกต้องหรือไม่อนุญาตตารางนี้");
        String primary=request.get("primaryKey")==null?null:String.valueOf(request.get("primaryKey")); int count=0;
        for(Object item:rows){
            if(!(item instanceof Map<?,?> row)||row.isEmpty()) continue; var columns=new ArrayList<String>(); var values=new ArrayList<>();
            for(var entry:row.entrySet()){String col=String.valueOf(entry.getKey()); if(!col.matches("[a-z][a-z0-9_]*")) throw new IllegalArgumentException("ชื่อคอลัมน์ไม่ถูกต้อง"); columns.add(col); values.add(entry.getValue());}
            String named=columns.stream().map(c->":"+c).reduce((a,b)->a+","+b).orElseThrow(); String sql="insert into rizenic_new."+table+" ("+String.join(",",columns)+") values ("+named+")";
            if(primary!=null&&!primary.isBlank()&&primary.matches("[a-z][a-z0-9_]*")){var updates=columns.stream().filter(c->!c.equals(primary)&&!c.equals("id")).map(c->c+"=excluded."+c).toList(); sql+=" on conflict ("+primary+") do "+(updates.isEmpty()?"nothing":"update set "+String.join(",",updates));}
            var spec=db.sql(sql); for(int i=0;i<columns.size();i++) spec=spec.param(columns.get(i),values.get(i)); spec.update(); count++;
        }
        audit.record("sync",0L,"SYNC",Map.of("table",table,"count",count)); return Map.of("success",true,"message","อัปโหลดเข้าตาราง "+table+" สำเร็จ "+count+" รายการ!","count",count);
    }
}
