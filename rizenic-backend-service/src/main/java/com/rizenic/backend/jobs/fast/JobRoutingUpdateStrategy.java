package com.rizenic.backend.jobs.fast;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobRoutingUpdateStrategy implements JobFastUpdateStrategy {
  private final JdbcClient db;

  public JobRoutingUpdateStrategy(JdbcClient db) {
    this.db = db;
  }

  public boolean supports(String f) {
    return List.of("customer_type", "department_routing", "sa_owner", "is_parked").contains(f);
  }

  public String update(Long id, String field, Object value) {
    if ("customer_type".equals(field))
      db.sql(
              "update rizenic_new.repair_jobs set customer_type_id=(select id from rizenic_new.customer_types where name=:v or code=:v limit 1) where id=:id")
          .param("v", value)
          .param("id", id)
          .update();
    else if ("department_routing".equals(field))
      db.sql(
              "update rizenic_new.repair_jobs set department_id=(select id from rizenic_new.departments where name=:v or code=:v limit 1) where id=:id")
          .param("v", value)
          .param("id", id)
          .update();
    else if ("sa_owner".equals(field))
      db.sql(
              "update rizenic_new.repair_jobs set service_advisor_id=(select id from rizenic_new.employees where display_name=:v or employee_code=:v limit 1) where id=:id")
          .param("v", value)
          .param("id", id)
          .update();
    else
      db.sql("update rizenic_new.repair_jobs set is_parked=:v where id=:id")
          .param("v", parked(value))
          .param("id", id)
          .update();
    return null;
  }

  private boolean parked(Object v) {
    return v != null
        && ("จอดซ่อม".equalsIgnoreCase(v.toString()) || Boolean.parseBoolean(v.toString()));
  }
}
