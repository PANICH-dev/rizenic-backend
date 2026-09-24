package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.CarBrandEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface CarBrandRepository extends JpaRepository<CarBrandEntity, Long> {
  List<CarBrandEntity> findByActiveTrueOrderByNameAsc();

  java.util.Optional<CarBrandEntity> findByCode(String code);

  java.util.Optional<CarBrandEntity> findByNameIgnoreCase(String name);
}
