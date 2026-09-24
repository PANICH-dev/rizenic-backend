package com.rizenic.backend.operations;

import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class OperationsController {
  private final OperationsService service;

  public OperationsController(OperationsService service) {
    this.service = service;
  }

  @PostMapping("/inspection")
  public ResponseEntity<Map<String, Object>> saveInspection(@RequestBody Map<String, Object> x) {
    return ResponseEntity.ok(Map.of("success", true, "data", service.saveInspection(x)));
  }

  @GetMapping("/inspection/{jobId}")
  public ResponseEntity<Map<String, Object>> inspection(@PathVariable String jobId) {
    return ResponseEntity.ok(Map.of("success", true, "data", service.inspection(jobId)));
  }

  @GetMapping("/quotas")
  public List<? extends Map<String, Object>> quotas() {
    return service.quotas();
  }

  @PostMapping("/quotas")
  public ResponseEntity<Map<String, Object>> createQuota(@RequestBody Map<String, Object> x) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(Map.of("success", true, "data", service.saveQuota(null, x)));
  }

  @PutMapping("/quotas/{id}")
  public Map<String, Object> updateQuota(
      @PathVariable Long id, @RequestBody Map<String, Object> x) {
    return service.saveQuota(id, x);
  }

  @DeleteMapping("/quotas/{id}")
  public Map<String, Object> deleteQuota(@PathVariable Long id) {
    service.deleteQuota(id);
    return Map.of("success", true);
  }

  @GetMapping("/user-preferences/{empName}")
  public Map<String, Object> preferences(@PathVariable String empName) {
    return service.preferences(empName);
  }

  @PostMapping("/user-preferences")
  public Map<String, Object> savePreferences(@RequestBody Map<String, Object> x) {
    service.savePreferences(x);
    return Map.of("success", true, "message", "บันทึกการตั้งค่าเรียบร้อยครับ");
  }

  @ExceptionHandler(NoSuchElementException.class)
  public ResponseEntity<Map<String, Object>> notFound(NoSuchElementException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("success", false, "message", e.getMessage()));
  }
}
