package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.BodyPartEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface BodyPartRepository extends JpaRepository<BodyPartEntity, Long> {
  List<BodyPartEntity> findByActiveTrueOrderByCategoryAscNameAsc();
}
