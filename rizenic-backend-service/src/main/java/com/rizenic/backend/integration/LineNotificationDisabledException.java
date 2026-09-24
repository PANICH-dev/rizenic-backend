package com.rizenic.backend.integration;

public class LineNotificationDisabledException extends RuntimeException {
  public LineNotificationDisabledException(String message) {
    super(message);
  }
}
