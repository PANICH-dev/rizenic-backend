package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "car_brands")
public class CarBrandEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String code;

  @Column(nullable = false)
  public String name;

  @Column(name = "is_active")
  public Boolean active;
}
