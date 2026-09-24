package com.rizenic.backend.operations;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsService {
  private final OperationsRepository repo;

  public OperationsService(OperationsRepository repo) {
    this.repo = repo;
  }

  @Transactional
  public Map<String, Object> saveInspection(Map<String, Object> x) {
    return repo.saveInspection(x, null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> inspection(String job) {
    return repo.inspectionByReference(job)
        .orElseThrow(() -> new NoSuchElementException("ไม่พบข้อมูลใบตรวจสภาพรถ"));
  }

  @Transactional(readOnly = true)
  public List<? extends Map<String, Object>> quotas() {
    return repo.quotas();
  }

  @Transactional
  public Map<String, Object> saveQuota(Long id, Map<String, Object> x) {
    return repo.saveQuota(id, x);
  }

  @Transactional
  public void deleteQuota(Long id) {
    repo.deleteQuota(id);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> preferences(String emp) {
    return repo.preferences(emp);
  }

  @Transactional
  public void savePreferences(Map<String, Object> x) {
    repo.savePreferences(x);
  }
}
