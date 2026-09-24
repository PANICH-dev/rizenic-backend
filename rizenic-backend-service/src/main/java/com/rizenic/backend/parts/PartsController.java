package com.rizenic.backend.parts;

import com.rizenic.backend.parts.PartsDtos.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class PartsController {
  private final PartsService s;

  public PartsController(PartsService s) {
    this.s = s;
  }

  @GetMapping("/parts")
  public List<Part> parts() {
    return s.parts();
  }

  @GetMapping("/parts/check/{partNo}")
  public Part check(@PathVariable String partNo) {
    return s.check(partNo);
  }

  @PostMapping("/parts")
  public ResponseEntity<Part> create(@RequestBody PartRequest x) {
    return ResponseEntity.status(201).body(s.save(null, x));
  }

  @PutMapping("/parts/{id}")
  public Part update(@PathVariable Long id, @RequestBody PartRequest x) {
    return s.save(id, x);
  }

  @DeleteMapping("/parts/{id}")
  public Map<String, Object> delete(@PathVariable Long id) {
    s.delete(id);
    return Map.of("success", true);
  }

  @GetMapping("/part-statuses")
  public List<PartStatus> statuses() {
    return s.statuses();
  }

  @PostMapping("/part-statuses")
  public PartStatus createStatus(@RequestBody StatusRequest x) {
    return s.saveStatus(x);
  }

  @DeleteMapping("/part-statuses/{id}")
  public Map<String, Object> deleteStatus(@PathVariable Long id) {
    s.deleteStatus(id);
    return Map.of("success", true);
  }

  @GetMapping("/part-orders")
  public List<LinkedHashMap<String, Object>> orders() {
    return s.orders();
  }

  @PostMapping("/part-orders")
  public Map<String, Object> order(@RequestBody OrderRequest x) {
    return Map.of("success", true, "insertedId", s.createOrder(x));
  }

  @PutMapping("/part-orders/{id}/fast")
  public Map<String, Object> fastOrder(@PathVariable Long id, @RequestBody Map<String, Object> x) {
    s.fastOrder(id, (String) x.get("field"), x.get("value"));
    return Map.of("success", true);
  }

  @DeleteMapping("/part-orders/{id}")
  public Map<String, Object> deleteOrder(@PathVariable Long id) {
    s.deleteOrder(id);
    return Map.of("success", true);
  }

  @PutMapping("/part-orders/{id}")
  public Map<String, Object> updateOrder(@PathVariable Long id, @RequestBody OrderRequest x) {
    s.updateOrder(id, x);
    return Map.of("success", true);
  }

  @GetMapping("/part-inbound")
  public List<LinkedHashMap<String, Object>> receipts() {
    return s.receipts();
  }

  @PostMapping("/part-inbound")
  public Map<String, Object> inbound(@RequestBody ReceiptRequest x) {
    return Map.of("success", true, "insertedId", s.createReceipt(x));
  }

  @PutMapping("/part-inbound/{id}/fast")
  public Map<String, Object> fastReceipt(
      @PathVariable Long id, @RequestBody Map<String, Object> x) {
    s.fastReceipt(id, (String) x.get("field"), x.get("value"));
    return Map.of("success", true);
  }

  @DeleteMapping("/part-inbound/{id}")
  public ResponseEntity<Map<String, Object>> deleteReceipt(@PathVariable Long id) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(Map.of("success", false, "error", "เอกสารรับเข้าต้อง reverse stock movement ก่อนลบ"));
  }

  @GetMapping("/part-outbound")
  public List<Outbound> outbounds() {
    return s.outbounds();
  }

  @PostMapping("/part-outbound")
  public Map<String, Object> outbound(@RequestBody OutboundRequest x) {
    return Map.of("success", true, "insertedId", s.createOutbound(x));
  }

  @PutMapping("/part-outbound/{id}/fast")
  public Map<String, Object> fastOutbound(
      @PathVariable Long id, @RequestBody Map<String, Object> x) {
    s.fastOutbound(id, (String) x.get("field"), x.get("value"));
    return Map.of("success", true);
  }

  @DeleteMapping("/part-outbound/{id}")
  public Map<String, Object> deleteOutbound(@PathVariable Long id) {
    s.reverseOutbound(id);
    return Map.of("success", true);
  }

  @PutMapping("/part-outbound/{id}")
  public Map<String, Object> updateOutbound(@PathVariable Long id, @RequestBody OutboundRequest x) {
    s.updateOutbound(id, x);
    return Map.of("success", true);
  }

  @GetMapping("/parts-inventory")
  public ResponseEntity<?> inventory(@RequestParam(required = false) String branch) {
    if (branch == null || branch.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "กรุณาระบุสาขา"));
    }
    return ResponseEntity.ok(s.inventory(branch));
  }
}
