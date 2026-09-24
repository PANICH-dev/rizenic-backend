package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.CustomerTypeEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface CustomerTypeRepository extends JpaRepository<CustomerTypeEntity, Long> {
  List<CustomerTypeEntity> findByActiveTrueOrderByNameAsc();

  java.util.Optional<CustomerTypeEntity> findByCode(String code);
}
