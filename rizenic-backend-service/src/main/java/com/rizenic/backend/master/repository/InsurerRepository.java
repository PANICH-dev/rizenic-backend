package com.rizenic.backend.master.repository;

import com.rizenic.backend.master.entity.InsurerEntity;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface InsurerRepository extends JpaRepository<InsurerEntity, Long> {
  List<InsurerEntity> findByActiveTrueOrderByCodeAsc();

  java.util.Optional<InsurerEntity> findByCode(String code);
}
