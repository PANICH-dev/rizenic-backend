package com.rizenic.backend.integration;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class IntegrationController {
  private final IntegrationService service;
  private final RobotOutboxService robotOutboxService;

  public IntegrationController(IntegrationService service, RobotOutboxService robotOutboxService) {
    this.service = service;
    this.robotOutboxService = robotOutboxService;
  }

  @PostMapping("/sync-dynamic")
  public Map<String, Object> sync(@RequestBody Map<String, Object> request) {
    return service.sync(request);
  }

  @PostMapping("/send-line-notify")
  public Map<String, Object> line(@RequestBody Map<String, Object> request) {
    return service.notifyLine(request);
  }

  @PostMapping("/robot/outbox")
  public ResponseEntity<Map<String, Object>> robotOutbox(@RequestBody Map<String, Object> request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(robotOutboxService.write(request));
  }
}
