package com.rizenic.backend.jobs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;
import com.rizenic.backend.jobs.fast.JobFastUpdateStrategy;

/** Application boundary for inline job updates. The persistence adapter is isolated here while handlers are split incrementally. */
@Component
public class JobFastUpdateService {
    private final JdbcClient db; private final List<JobFastUpdateStrategy> strategies;
    public JobFastUpdateService(JdbcClient db, List<JobFastUpdateStrategy> strategies) { this.db = db; this.strategies = strategies; }
    private Object date(Object v) { if (v == null || v.toString().isBlank()) return null; return v instanceof LocalDate ? v : LocalDate.parse(v.toString()); }
    private boolean parked(Object v) { return v != null && ("จอดซ่อม".equalsIgnoreCase(v.toString()) || Boolean.parseBoolean(v.toString())); }
    private void documents(Long job, Object value, String type) { if (value == null) return; db.sql("delete from rizenic_new.job_documents where job_id=:j and document_type=:t").param("j",job).param("t",type).update(); for (var n:value.toString().split(",")) if (!n.isBlank()) db.sql("insert into rizenic_new.job_documents(job_id,document_type,document_number) values(:j,:t,:n) on conflict do nothing").param("j",job).param("t",type).param("n",n.trim()).update(); }
    public String update(Long id, String field, Object value) {
        for (var strategy : strategies) if (strategy.supports(field)) return strategy.update(id, field, value);
        String col=switch(field){case "notes"->"notes";case "repair_notes"->"repair_notes";case "damage_level"->"damage_level";case "payment_type"->"payment_label";default->null;};
        if (col == null) throw new IllegalArgumentException("ไม่อนุญาตให้แก้ฟิลด์นี้");
        db.sql("update rizenic_new.repair_jobs set "+col+"=:v where id=:id").param("v",col.endsWith("_on")?date(value):(value==null||value.toString().isBlank()?null:value)).param("id",id).update(); return null;
    }
}
