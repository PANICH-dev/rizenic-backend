package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.BranchEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface BranchRepository extends JpaRepository<BranchEntity, Long> {
  Optional<BranchEntity> findByNameIgnoreCase(String name);
}
