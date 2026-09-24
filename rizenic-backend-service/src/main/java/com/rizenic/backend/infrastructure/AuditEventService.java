package com.rizenic.backend.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class AuditEventService {
  private final JdbcClient db;
  private final ObjectMapper json = new ObjectMapper();

  public AuditEventService(JdbcClient db) {
    this.db = db;
  }

  private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuditEventService.class);

  public void record(String entityType, Long entityId, String action, Map<String, Object> changes) {
    try {
      db.sql(
              "insert into rizenic_new.audit_events(entity_type,entity_id,action,changes) values(:t,:i,:a,cast(:c as jsonb))")
          .param("t", entityType)
          .param("i", entityId == null ? 0L : entityId)
          .param("a", action)
          .param("c", json.writeValueAsString(changes == null ? Map.of() : changes))
          .update();
    } catch (Exception e) {
      log.warn("Failed to record audit event: type={}, id={}, action={}. Reason: {}", entityType, entityId, action, e.getMessage(), e);
    }
  }
}
