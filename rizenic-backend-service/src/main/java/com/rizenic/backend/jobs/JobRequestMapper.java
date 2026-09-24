package com.rizenic.backend.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class JobRequestMapper {
  private final ObjectMapper mapper = new ObjectMapper();

  public Map<String, Object> map(Object request) {
    var raw = mapper.convertValue(request, Map.class);
    var result = new LinkedHashMap<String, Object>();
    raw.forEach(
        (k, v) -> {
          if (v != null) result.put(String.valueOf(k), v);
        });
    return result;
  }
}
