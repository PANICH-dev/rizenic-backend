package com.rizenic.backend.jobs.fast;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobCustomerUpdateStrategy implements JobFastUpdateStrategy {
  private final JdbcClient db;

  public JobCustomerUpdateStrategy(JdbcClient db) {
    this.db = db;
  }

  public boolean supports(String f) {
    return List.of("customer_name", "phone_number", "customer_phone").contains(f);
  }

  public String update(Long id, String field, Object value) {
    if ("customer_name".equals(field))
      db.sql(
              "update rizenic_new.customers set display_name=:v where id=(select customer_id from rizenic_new.repair_jobs where id=:id)")
          .param("v", value)
          .param("id", id)
          .update();
    else
      db.sql(
              "update rizenic_new.customer_contacts set raw_value=:v where id=(select id from rizenic_new.customer_contacts where customer_id=(select customer_id from rizenic_new.repair_jobs where id=:id) and contact_type='PHONE' order by is_primary desc,id limit 1)")
          .param("v", value)
          .param("id", id)
          .update();
    return null;
  }
}
