package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "insurers")
public class InsurerEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String code;

  @Column(nullable = false)
  public String name;

  @Column(name = "insurance_type")
  public String insuranceType;

  @Column(name = "is_active")
  public Boolean active;
}
