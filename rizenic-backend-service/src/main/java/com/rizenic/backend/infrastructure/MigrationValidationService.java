package com.rizenic.backend.infrastructure;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class MigrationValidationService {
  private final JdbcClient jdbc;

  public MigrationValidationService(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Map<String, Object> validate() {
    var result = new LinkedHashMap<String, Object>();
    result.put("database", jdbc.sql("select current_database()").query(String.class).single());
    result.put("schema", jdbc.sql("select current_schema()").query(String.class).single());
    var expected =
        List.of(
            "branches",
            "departments",
            "employees",
            "customer_types",
            "customers",
            "car_brands",
            "car_models",
            "insurers",
            "job_statuses",
            "body_parts",
            "repair_jobs");
    var missing =
        expected
            .stream()
            .filter(
                t ->
                    jdbc.sql("select to_regclass(:name) is null")
                        .param("name", "rizenic_new." + t)
                        .query(Boolean.class)
                        .single())
            .toList();
    result.put("missing_tables", missing);
    var counts = new LinkedHashMap<String, Long>();
    for (var table :
        List.of(
            "repair_jobs",
            "customers",
            "car_brands",
            "car_models",
            "insurers",
            "job_statuses",
            "body_parts",
            "employees")) {
      counts.put(
          table, jdbc.sql("select count(*) from rizenic_new." + table).query(Long.class).single());
    }
    result.put("counts", counts);
    result.put("valid", "rizenic_new".equals(result.get("schema")) && missing.isEmpty());
    return result;
  }
}
