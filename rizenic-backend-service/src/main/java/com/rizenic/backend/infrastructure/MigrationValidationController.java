package com.rizenic.backend.infrastructure;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/migration", "/api/migration"})
public class MigrationValidationController {
  private final MigrationValidationService service;

  public MigrationValidationController(MigrationValidationService service) {
    this.service = service;
  }

  @GetMapping("/validation")
  public Map<String, Object> validation() {
    return service.validate();
  }
}
