package com.rizenic.backend.master.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "user_accounts")
public class UserAccountEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "employee_id", nullable = false)
  public Long employeeId;

  @Column(nullable = false)
  public String username;

  @Column(name = "password_hash")
  public String passwordHash;

  @Column(name = "credential_state")
  public String credentialState;
}
