package com.rizenic.backend.jobs;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobVehicleService {
  private final JdbcClient db;

  public JobVehicleService(JdbcClient db) {
    this.db = db;
  }

  public Long resolve(Map<String, Object> x) {
    var vin = x.get("vin_no");
    if (vin != null && !vin.toString().isBlank()) {
      var found =
          db.sql("select id from rizenic_new.vehicles where vin=:v")
              .param("v", vin)
              .query(Long.class)
              .optional();
      if (found.isPresent()) return found.get();
    }
    var plate = x.get("car_plate");
    if (plate != null && !plate.toString().isBlank()) {
      var found =
          db.sql("select id from rizenic_new.vehicles where plate_number=:p order by id limit 1")
              .param("p", plate)
              .query(Long.class)
              .optional();
      if (found.isPresent()) return found.get();
    }
    var model = x.get("car_model");
    Long modelId =
        model == null
            ? null
            : db.sql(
                    "select id from rizenic_new.car_models where lower(model_name)=lower(:m) limit 1")
                .param("m", model)
                .query(Long.class)
                .optional()
                .orElse(null);
    return db.sql(
            "insert into rizenic_new.vehicles(vin,plate_number,color,car_model_id) values(:v,:p,:c,:m) returning id")
        .param("v", vin)
        .param("p", plate)
        .param("c", x.get("car_color"))
        .param("m", modelId)
        .query(Long.class)
        .single();
  }
}
