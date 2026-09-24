package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.JobStatusEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface JobStatusRepository extends JpaRepository<JobStatusEntity, Long> {
  List<JobStatusEntity> findByActiveTrueOrderBySortOrderAscCodeAsc();

  java.util.Optional<JobStatusEntity> findByCode(String code);
}
