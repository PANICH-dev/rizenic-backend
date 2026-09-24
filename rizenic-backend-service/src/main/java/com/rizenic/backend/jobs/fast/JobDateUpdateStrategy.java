package com.rizenic.backend.jobs.fast;
import org.springframework.jdbc.core.simple.JdbcClient; import org.springframework.stereotype.Component; import java.time.LocalDate; import java.util.*;
@Component public class JobDateUpdateStrategy implements JobFastUpdateStrategy {
 private final JdbcClient db; public JobDateUpdateStrategy(JdbcClient db){this.db=db;}
 private static final Set<String> FIELDS=Set.of("target_finish_date","actual_finish_date","repair_finish_date","delivery_date","contact_date","appointment_date","arrived_date","order_part_date","est_part_date");
 public boolean supports(String f){return FIELDS.contains(f);}
 public String update(Long id,String field,Object value){Object v=value==null||value.toString().isBlank()?null:LocalDate.parse(value.toString());if(field.equals("order_part_date")||field.equals("est_part_date")){String c=field.equals("order_part_date")?"ordered_on":"estimated_arrival_on";db.sql("insert into rizenic_new.job_part_tracking(job_id,"+c+") values(:j,:v) on conflict(job_id) do update set "+c+"=excluded."+c).param("j",id).param("v",v).update();return null;}String c=switch(field){case "target_finish_date"->"target_finish_on";case "actual_finish_date"->"actual_finish_on";case "repair_finish_date"->"repair_finished_on";case "delivery_date"->"delivery_on";case "contact_date"->"contact_on";case "appointment_date"->"appointment_on";default->"intake_on";};db.sql("update rizenic_new.repair_jobs set "+c+"=:v where id=:id").param("v",v).param("id",id).update();return null;}
}
