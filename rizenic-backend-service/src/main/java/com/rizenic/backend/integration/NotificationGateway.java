package com.rizenic.backend.integration;

public interface NotificationGateway {
  void sendText(String branch, String message);
}
