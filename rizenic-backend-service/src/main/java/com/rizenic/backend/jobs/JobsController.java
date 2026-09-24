package com.rizenic.backend.jobs;

import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class JobsController {
  private final JobsService s;
  private final JobRequestMapper mapper;

  public JobsController(JobsService s, JobRequestMapper mapper) {
    this.s = s;
    this.mapper = mapper;
  }

  @GetMapping({"/reports", "/report", "/jobs"})
  public List<JobDtos.JobResponse> reports() {
    return s.all();
  }

  @GetMapping("/report/{id}")
  public ResponseEntity<?> report(@PathVariable Long id) {
    try {
      return ResponseEntity.ok(s.one(id));
    } catch (NoSuchElementException e) {
      return ResponseEntity.status(404).body(Map.of("error", "ไม่พบข้อมูลใบงานนี้"));
    }
  }

  @PostMapping("/report")
  public ResponseEntity<Map<String, Object>> create(@RequestBody JobDtos.JobCreateRequest x) {
    return ResponseEntity.status(201)
        .body(Map.of("success", true, "insertedId", s.create(mapper.map(x))));
  }

  @PutMapping("/report/{id}")
  public Map<String, Object> update(
      @PathVariable Long id, @RequestBody JobDtos.JobUpdateRequest x) {
    s.update(id, mapper.map(x));
    return Map.of("success", true);
  }

  @DeleteMapping("/report/{id}")
  public ResponseEntity<?> delete(@PathVariable Long id) {
    if (!s.archive(id))
      return ResponseEntity.status(404).body(Map.of("error", "ไม่พบใบงานที่ต้องการลบ"));
    return ResponseEntity.ok(Map.of("success", true, "message", "ลบข้อมูลสำเร็จ"));
  }

  @PutMapping("/report/{id}/station")
  public Map<String, Object> station(@PathVariable Long id, @RequestBody Map<String, Object> x) {
    s.station(id, x);
    return Map.of("success", true);
  }

  @PutMapping("/report/{id}/fast-date")
  public Map<String, Object> fast(@PathVariable Long id, @RequestBody JobDtos.FastUpdateRequest x) {
    var dep = s.fast(id, x.field(), x.value());
    return dep == null
        ? Map.of("success", true)
        : Map.of("success", true, "department_routing", dep);
  }
}
