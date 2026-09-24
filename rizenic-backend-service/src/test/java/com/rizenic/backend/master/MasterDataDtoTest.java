package com.rizenic.backend.master;

import static org.junit.jupiter.api.Assertions.*;

import com.rizenic.backend.master.dto.MasterDtos;
import org.junit.jupiter.api.Test;

class MasterDataDtoTest {
  @Test
  void legacyAliasesAreAvailable() {
    var dto = new MasterDtos.BrandModel(1L, "aion", "Aion", "Y Plus", "Aion", "Y Plus");
    assertEquals("Aion", dto.carBrand());
    assertEquals("Y Plus", dto.carModel());
  }
}
