package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.DepartmentEntity;
import org.springframework.data.jpa.repository.*;

public interface DepartmentRepository extends JpaRepository<DepartmentEntity, Long> {}
