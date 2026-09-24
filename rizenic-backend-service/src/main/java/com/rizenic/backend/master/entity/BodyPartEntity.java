package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "body_parts")
public class BodyPartEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String name;

  @Column(nullable = false)
  public String category;

  @Column(name = "is_active")
  public Boolean active;
}
