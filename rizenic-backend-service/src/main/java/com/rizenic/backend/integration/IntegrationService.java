package com.rizenic.backend.integration;

import java.util.Map;
import org.springframework.stereotype.Service;

/** Backward-compatible facade. Business responsibilities live in dedicated services. */
@Service
public class IntegrationService {
  private final DynamicSyncService sync;
  private final LineNotificationService line;

  public IntegrationService(DynamicSyncService sync, LineNotificationService line) {
    this.sync = sync;
    this.line = line;
  }

  public Map<String, Object> sync(Map<String, Object> request) {
    return sync.sync(request);
  }

  public Map<String, Object> notifyLine(Map<String, Object> request) {
    return line.send(request);
  }
}
