package com.rizenic.backend.jobs;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JobResponseTest {
  @Test
  void responseSerializesAsLegacyFlatObject() throws Exception {
    var json =
        new ObjectMapper()
            .writeValueAsString(new JobDtos.JobResponse(Map.of("id", 7, "customer_name", "Demo")));
    assertTrue(json.contains("\"id\":7"));
    assertTrue(json.contains("\"customer_name\":\"Demo\""));
  }
}
