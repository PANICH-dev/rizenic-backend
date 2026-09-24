package com.rizenic.backend.jobs;

import static org.junit.jupiter.api.Assertions.*;

import com.rizenic.backend.jobs.domain.RepairJobPort;
import com.rizenic.backend.jobs.domain.RepairJobQueryPort;
import java.util.*;
import org.junit.jupiter.api.Test;

class JobsServiceTest {
  @Test
  void fastUpdateDelegatesThroughDomainPort() {
    RepairJobPort port =
        new RepairJobPort() {
          public List<LinkedHashMap<String, Object>> findAll() {
            return List.of();
          }

          public Optional<LinkedHashMap<String, Object>> findOne(Long id) {
            return Optional.empty();
          }

          public Long create(Map<String, Object> request) {
            return 1L;
          }

          public void update(Long id, Map<String, Object> request) {}

          public boolean archive(Long id) {
            return true;
          }

          public String fast(Long id, String field, Object value) {
            return "SA";
          }

          public void station(Long id, String code, boolean done) {}
        };
    var service =
        new JobsService(
            port,
            new RepairJobQueryPort() {
              public List<LinkedHashMap<String, Object>> findAll() {
                return List.of();
              }

              public Optional<LinkedHashMap<String, Object>> findOne(Long id) {
                return Optional.empty();
              }
            });
    assertEquals("SA", service.fast(7L, "job_status", "OPEN"));
  }
}
