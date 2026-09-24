package com.rizenic.backend.jobs.fast;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobStatusUpdateStrategy implements JobFastUpdateStrategy {
  private final JdbcClient db;

  public JobStatusUpdateStrategy(JdbcClient db) {
    this.db = db;
  }

  public boolean supports(String field) {
    return "job_status".equals(field);
  }

  public String update(Long jobId, String field, Object value) {
    var department =
        db.sql(
                "select d.name from rizenic_new.job_statuses s left join rizenic_new.departments d on d.id=s.department_id where s.name=:v or s.code=:v limit 1")
            .param("v", value)
            .query(String.class)
            .optional()
            .orElse(null);
    db.sql(
            "update rizenic_new.repair_jobs set status_id=(select id from rizenic_new.job_statuses where name=:v or code=:v limit 1),department_id=(select department_id from rizenic_new.job_statuses where name=:v or code=:v limit 1) where id=:id")
        .param("v", value)
        .param("id", jobId)
        .update();
    return department;
  }
}
