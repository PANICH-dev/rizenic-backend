package com.rizenic.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Writes a stable, Robot Framework friendly event file after a repair job is saved. */
@Service
public class RobotOutboxService {
  private final ObjectMapper objectMapper;
  private final Path outboxDirectory;

  public RobotOutboxService(@Value("${ROBOT_OUTBOX_PATH:}") String outboxPath) {
    this.objectMapper = new ObjectMapper();
    this.outboxDirectory = resolveOutboxDirectory(outboxPath);
  }

  static Path resolveOutboxDirectory(String configuredPath) {
    if (configuredPath != null && !configuredPath.isBlank()) {
      return Path.of(configuredPath).toAbsolutePath().normalize();
    }

    Path workingDirectory = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
    for (Path candidate = workingDirectory; candidate != null; candidate = candidate.getParent()) {
      Path robotDirectory = candidate.resolve("robot-framework");
      if (Files.isDirectory(robotDirectory)) {
        return robotDirectory.resolve("job-json-input").normalize();
      }
    }

    return workingDirectory.resolve("robot-framework/job-json-input").normalize();
  }

  public Map<String, Object> write(Map<String, Object> request) {
    String jobId = safeId(request.get("job_id"));
    String fileName = "repair-job-" + jobId + ".json";
    try {
      Files.createDirectories(outboxDirectory);
      Map<String, Object> document = new LinkedHashMap<>();
      document.put("schema_version", "rizenic.robot.job.v1");
      document.put("event_type", "REPAIR_JOB_SAVED");
      document.put("status", "READY");
      document.put("created_at", Instant.now().toString());
      document.put("job_id", request.getOrDefault("job_id", jobId));
      document.put("file_name", fileName);
      document.putAll(request);
      document.put("payload", request);

      Path target = outboxDirectory.resolve(fileName).normalize();
      if (!target.getParent().equals(outboxDirectory)) {
        throw new IllegalArgumentException("Invalid robot outbox file name");
      }
      Path temporary = outboxDirectory.resolve(fileName + ".tmp");
      objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), document);
      try {
        Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
      } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
        Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
      }
      return Map.of("success", true, "file_name", fileName, "path", target.toString(),
          "job_id", request.getOrDefault("job_id", jobId), "schema_version", "rizenic.robot.job.v1");
    } catch (IOException ex) {
      throw new IllegalStateException("ไม่สามารถสร้างไฟล์ Robot outbox ได้", ex);
    }
  }

  private String safeId(Object raw) {
    String value = raw == null ? "" : String.valueOf(raw).trim();
    value = value.replaceAll("[^A-Za-z0-9_-]", "_");
    return value.isBlank() ? UUID.randomUUID().toString() : value;
  }
}
