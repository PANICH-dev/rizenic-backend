package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "job_statuses")
public class JobStatusEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String code;

  @Column(nullable = false)
  public String name;

  @Column(name = "department_id")
  public Long departmentId;

  @Column(name = "legacy_route_page")
  public String legacyRoutePage;

  @Column(name = "sort_order")
  public Integer sortOrder;

  @Column(name = "is_active")
  public Boolean active;
}
