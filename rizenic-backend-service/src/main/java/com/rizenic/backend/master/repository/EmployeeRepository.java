package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.EmployeeEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface EmployeeRepository extends JpaRepository<EmployeeEntity, Long> {
  List<EmployeeEntity> findByActiveTrueOrderByEmployeeCodeAsc();
}
