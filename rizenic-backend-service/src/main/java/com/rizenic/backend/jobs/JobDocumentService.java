package com.rizenic.backend.jobs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobDocumentService {
  private final JdbcClient db;

  public JobDocumentService(JdbcClient db) {
    this.db = db;
  }

  public void replace(Long jobId, Object value, String type) {
    if (value == null) return;
    db.sql("delete from rizenic_new.job_documents where job_id=:j and document_type=:t")
        .param("j", jobId)
        .param("t", type)
        .update();
    for (var number : value.toString().split(",")) {
      if (!number.isBlank()) {
        db.sql(
                "insert into rizenic_new.job_documents(job_id,document_type,document_number) values(:j,:t,:n) on conflict do nothing")
            .param("j", jobId)
            .param("t", type)
            .param("n", number.trim())
            .update();
      }
    }
  }
}
