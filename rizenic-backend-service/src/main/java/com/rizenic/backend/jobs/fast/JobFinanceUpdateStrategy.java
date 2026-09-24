package com.rizenic.backend.jobs.fast;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import java.time.LocalDate; import java.util.*;
@Component public class JobFinanceUpdateStrategy implements JobFastUpdateStrategy {
 private final JdbcClient db; public JobFinanceUpdateStrategy(JdbcClient db){this.db=db;}
 public boolean supports(String f){return List.of("cost_labor","cost_part","cost_external","billing_date","insurance_pay_date").contains(f);}
 public String update(Long id,String field,Object value){String col=switch(field){case "cost_labor"->"labor_amount";case "cost_part"->"parts_amount";case "cost_external"->"external_amount";case "billing_date"->"billing_on";default->"insurance_paid_on";};Object v=field.endsWith("date")||field.endsWith("_date")?(value==null||value.toString().isBlank()?null:LocalDate.parse(value.toString())):value;db.sql("insert into rizenic_new.job_financial_summaries(job_id,"+col+") values(:j,:v) on conflict(job_id) do update set "+col+"=excluded."+col).param("j",id).param("v",v).update();return null;}
}
