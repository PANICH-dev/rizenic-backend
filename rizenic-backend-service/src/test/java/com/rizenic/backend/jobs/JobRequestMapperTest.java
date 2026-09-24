package com.rizenic.backend.jobs;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class JobRequestMapperTest {
  @Test
  void mapsTypedCreateRequestToLegacyFieldNames() {
    var mapper = new JobRequestMapper();
    var request =
        JobDtos.JobCreateRequest.ofMinimal(
            "Navamin", "Test", "0812", "1กข 1", "Model", "note", "QT-1", "SO-1");
    var mapped = mapper.map(request);
    assertEquals("Navamin", mapped.get("branch_name"));
    assertTrue(mapped.containsKey("branch_name"));
    assertFalse(mapped.containsKey("car_brand"));
  }
}
