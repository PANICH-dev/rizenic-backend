package com.rizenic.backend.infrastructure;

import com.rizenic.backend.integration.LineNotificationDisabledException;
import java.util.*;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Converts application failures into one predictable API error contract. */
@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(NoSuchElementException.class)
  ResponseEntity<Map<String, Object>> notFound(NoSuchElementException e) {
    return response(HttpStatus.NOT_FOUND, e.getMessage() == null ? "ไม่พบข้อมูล" : e.getMessage());
  }

  @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class})
  ResponseEntity<Map<String, Object>> badRequest(Exception e) {
    return response(
        HttpStatus.BAD_REQUEST, e.getMessage() == null ? "ข้อมูลไม่ถูกต้อง" : e.getMessage());
  }

  @ExceptionHandler(LineNotificationDisabledException.class)
  ResponseEntity<Map<String, Object>> forbidden(LineNotificationDisabledException e) {
    return response(HttpStatus.FORBIDDEN, e.getMessage());
  }

  @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
  ResponseEntity<Map<String, Object>> methodNotSupported(
      org.springframework.web.HttpRequestMethodNotSupportedException e) {
    return response(HttpStatus.METHOD_NOT_ALLOWED, e.getMessage());
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  ResponseEntity<Map<String, Object>> resourceNotFound(
      org.springframework.web.servlet.resource.NoResourceFoundException e) {
    return response(HttpStatus.NOT_FOUND, "ไม่พบเส้นทาง API: " + e.getResourcePath());
  }

  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(DataAccessException.class)
  ResponseEntity<Map<String, Object>> database(DataAccessException e) {
    Throwable root = e.getRootCause();
    if (root instanceof IllegalArgumentException) {
      return response(HttpStatus.BAD_REQUEST, root.getMessage());
    }
    log.error("Database error occurred", e);
    return response(HttpStatus.INTERNAL_SERVER_ERROR, "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unexpected(Exception e) {
    log.error("Unexpected error occurred", e);
    return response(HttpStatus.INTERNAL_SERVER_ERROR, "เกิดข้อผิดพลาดภายในระบบ");
  }

  private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
    return ResponseEntity.status(status)
        .body(Map.of("success", false, "error", message, "message", message));
  }
}
