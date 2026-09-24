package com.rizenic.backend.auth;

import com.rizenic.backend.infrastructure.SessionTokenService;
import com.rizenic.backend.master.MasterDataService;
import com.rizenic.backend.master.dto.MasterDtos.LoginRequest;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class AuthController {
  private final MasterDataService service;
  private final SessionTokenService tokens;

  public AuthController(MasterDataService service, SessionTokenService tokens) {
    this.service = service;
    this.tokens = tokens;
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request) {
    try {
      var result = service.login(request);
      var employee = (com.rizenic.backend.master.dto.MasterDtos.Employee) result.get("employee");
      var response = new java.util.LinkedHashMap<String, Object>(result);
      response.put("token", tokens.issue(employee.id()));
      response.put("expires_in", 28800);
      return ResponseEntity.ok(response);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("success", false, "error", "Username หรือ Password ไม่ถูกต้อง"));
    }
  }
}
