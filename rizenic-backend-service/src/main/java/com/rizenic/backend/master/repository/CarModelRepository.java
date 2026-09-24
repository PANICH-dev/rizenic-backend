package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.CarModelEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface CarModelRepository extends JpaRepository<CarModelEntity, Long> {
  List<CarModelEntity> findByActiveTrueOrderByBrandIdAscModelNameAsc();
}
