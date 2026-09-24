package com.rizenic.backend.jobs.domain;

import java.util.*;

public interface RepairJobQueryPort {
  List<LinkedHashMap<String, Object>> findAll();

  Optional<LinkedHashMap<String, Object>> findOne(Long id);
}
