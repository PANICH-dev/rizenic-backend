package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.UserAccountEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface UserAccountRepository extends JpaRepository<UserAccountEntity, Long> {
  Optional<UserAccountEntity> findByUsernameIgnoreCase(String username);
}
