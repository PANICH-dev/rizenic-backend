package com.rizenic.backend.jobs;

import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobCustomerService {
  private final JdbcClient db;

  public JobCustomerService(JdbcClient db) {
    this.db = db;
  }

  public Long resolve(Map<String, Object> x) {
    var phone = x.get("phone_number");
    var name = x.get("customer_name");
    var normalized = phone == null ? null : phone.toString().replaceAll("[^0-9+]", "");
    var existing =
        normalized == null
            ? Optional.<Long>empty()
            : db.sql(
                    "select customer_id from rizenic_new.customer_identity_keys where key_type='PHONE' and normalized_key=:p")
                .param("p", normalized)
                .query(Long.class)
                .optional();
    Long id =
        existing.orElseGet(
            () ->
                db.sql(
                        "insert into rizenic_new.customers(display_name) values(coalesce(nullif(:n,''),'Legacy API customer')) returning id")
                    .param("n", name == null ? null : name.toString())
                    .query(Long.class)
                    .single());
    if (normalized != null && !normalized.isBlank()) {
      db.sql(
              "insert into rizenic_new.customer_identity_keys(customer_id,key_type,normalized_key) values(:c,'PHONE',:p) on conflict do nothing")
          .param("c", id)
          .param("p", normalized)
          .update();
      db.sql(
              "insert into rizenic_new.customer_contacts(customer_id,contact_type,raw_value,is_primary) values(:c,'PHONE',:p,true) on conflict do nothing")
          .param("c", id)
          .param("p", phone)
          .update();
    }
    return id;
  }
}
