package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "employees")
public class EmployeeEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "employee_code", nullable = false)
  public String employeeCode;

  @Column(name = "display_name", nullable = false)
  public String displayName;

  public String phone;

  @Column(name = "home_branch_id")
  public Long homeBranchId;

  @Column(name = "is_active")
  public Boolean active;
}
