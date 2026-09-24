package com.rizenic.backend.jobs.fast;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobVehicleUpdateStrategy implements JobFastUpdateStrategy {
  private final JdbcClient db;

  public JobVehicleUpdateStrategy(JdbcClient db) {
    this.db = db;
  }

  public boolean supports(String f) {
    return List.of("car_plate", "car_color", "vin_no").contains(f);
  }

  public String update(Long id, String field, Object value) {
    String col =
        field.equals("car_plate") ? "plate_number" : field.equals("car_color") ? "color" : "vin";
    db.sql(
            "update rizenic_new.vehicles set "
                + col
                + "=:v where id=(select vehicle_id from rizenic_new.repair_jobs where id=:id)")
        .param("v", value)
        .param("id", id)
        .update();
    return null;
  }
}
