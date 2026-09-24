package com.rizenic.backend.integration;

import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class LineNotificationService {
  private final NotificationGateway gateway;

  public LineNotificationService(NotificationGateway gateway) {
    this.gateway = gateway;
  }

  public Map<String, Object> send(Map<String, Object> request) {
    if ("true".equalsIgnoreCase(System.getenv().getOrDefault("DISABLE_LINE_NOTIFICATIONS", "true")))
      throw new LineNotificationDisabledException(
          "LINE notifications are disabled in this environment.");
    String branch = String.valueOf(request.getOrDefault("branch", ""));
    String message = String.valueOf(request.getOrDefault("message", ""));
    if (message.isBlank()) throw new IllegalArgumentException("ไม่มีข้อความให้ส่ง");
    gateway.sendText(branch, message);
    return Map.of("success", true, "message", "ส่งเข้ากลุ่ม LINE เรียบร้อยครับ!");
  }
}
