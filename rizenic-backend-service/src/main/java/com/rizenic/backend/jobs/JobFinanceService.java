package com.rizenic.backend.jobs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.time.LocalDate;

@Component
public class JobFinanceService {
    private final JdbcClient db;
    public JobFinanceService(JdbcClient db) { this.db = db; }
    public void save(Long jobId, Map<String,Object> x) {
        if (x.get("cost_labor") == null && x.get("cost_part") == null && x.get("cost_external") == null && x.get("billing_date") == null && x.get("insurance_pay_date") == null) return;
        db.sql("""
                insert into rizenic_new.job_financial_summaries(job_id,labor_amount,parts_amount,external_amount,billing_on,insurance_paid_on)
                values(:j,:l,:p,:e,:b,:i)
                on conflict(job_id) do update set labor_amount=coalesce(excluded.labor_amount,job_financial_summaries.labor_amount),parts_amount=coalesce(excluded.parts_amount,job_financial_summaries.parts_amount),external_amount=coalesce(excluded.external_amount,job_financial_summaries.external_amount),billing_on=coalesce(excluded.billing_on,job_financial_summaries.billing_on),insurance_paid_on=coalesce(excluded.insurance_paid_on,job_financial_summaries.insurance_paid_on)
        """).param("j",jobId).param("l",x.get("cost_labor")).param("p",x.get("cost_part")).param("e",x.get("cost_external")).param("b",date(x.get("billing_date"))).param("i",date(x.get("insurance_pay_date"))).update();
    }
    private Object date(Object v){return v==null||v.toString().isBlank()?null:(v instanceof LocalDate?v:LocalDate.parse(v.toString()));}
}
