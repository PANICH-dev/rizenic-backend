package com.rizenic.backend.parts;

import com.rizenic.backend.parts.PartsDtos.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PartsService {
  private final PartsRepository repo;

  public PartsService(PartsRepository repo) {
    this.repo = repo;
  }

  @Transactional(readOnly = true)
  public List<Part> parts() {
    return repo.findParts();
  }

  @Transactional(readOnly = true)
  public Part check(String n) {
    return repo.check(n).orElseThrow();
  }

  @Transactional
  public Part save(Long id, PartRequest x) {
    return repo.savePart(id, x);
  }

  @Transactional
  public void delete(Long id) {
    repo.deletePart(id);
  }

  @Transactional(readOnly = true)
  public List<PartStatus> statuses() {
    return repo.statuses();
  }

  @Transactional
  public PartStatus saveStatus(StatusRequest x) {
    return repo.saveStatus(x);
  }

  @Transactional
  public void deleteStatus(Long id) {
    repo.deleteStatus(id);
  }

  @Transactional
  public Long createOrder(OrderRequest x) {
    return repo.createOrder(x);
  }

  @Transactional(readOnly = true)
  public List<LinkedHashMap<String, Object>> orders() {
    return repo.orders();
  }

  @Transactional
  public void fastOrder(Long id, String field, Object value) {
    repo.fastOrder(id, field, value);
  }

  @Transactional
  public void deleteOrder(Long id) {
    repo.deleteOrder(id);
  }

  @Transactional
  public void updateOrder(Long id, OrderRequest x) {
    if (x.epcNo() != null) repo.fastOrder(id, "epc_no", x.epcNo());
    if (x.orderDate() != null) repo.fastOrder(id, "order_date", x.orderDate());
    if (x.notes() != null) repo.fastOrder(id, "notes", x.notes());
  }

  @Transactional
  public Long createReceipt(ReceiptRequest x) {
    return repo.createReceipt(x);
  }

  @Transactional(readOnly = true)
  public List<LinkedHashMap<String, Object>> receipts() {
    return repo.receipts();
  }

  @Transactional
  public void fastReceipt(Long id, String field, Object value) {
    repo.fastReceipt(id, field, value);
  }

  @Transactional
  public Long createOutbound(OutboundRequest x) {
    return repo.createOutbound(x);
  }

  @Transactional(readOnly = true)
  public List<Outbound> outbounds() {
    return repo.outbounds();
  }

  @Transactional
  public void fastOutbound(Long id, String field, Object value) {
    repo.fastOutbound(id, field, value);
  }

  @Transactional
  public void reverseOutbound(Long id) {
    repo.reverseOutbound(id);
  }

  @Transactional
  public void updateOutbound(Long id, OutboundRequest x) {
    if (x.issueDate() != null) repo.fastOutbound(id, "issue_date", x.issueDate());
  }

  @Transactional(readOnly = true)
  public List<Inventory> inventory(String branch) {
    return repo.inventory(branch);
  }
}
