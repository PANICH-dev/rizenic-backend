package com.rizenic.backend.jobs.domain;

import java.util.*;

/** Driving port for repair-job use cases. Persistence details stay behind this boundary. */
public interface RepairJobPort {
  Long create(Map<String, Object> request);

  void update(Long id, Map<String, Object> request);

  boolean archive(Long id);

  String fast(Long id, String field, Object value);

  void station(Long id, String code, boolean done);
}
