package com.rizenic.backend.jobs;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class JobDtosTest {
  @Test
  void fastUpdateRequestKeepsLegacyFieldAndValue() {
    var request = new JobDtos.FastUpdateRequest("job_status", "10.กำลังซ่อม");
    assertEquals("job_status", request.field());
    assertEquals("10.กำลังซ่อม", request.value());
  }
}
