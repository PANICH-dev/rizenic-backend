package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "car_models")
public class CarModelEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "brand_id", nullable = false)
  public Long brandId;

  @Column(name = "model_name", nullable = false)
  public String modelName;

  @Column(name = "is_active")
  public Boolean active;
}
