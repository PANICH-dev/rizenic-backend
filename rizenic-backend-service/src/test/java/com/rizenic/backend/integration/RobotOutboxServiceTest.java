package com.rizenic.backend.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RobotOutboxServiceTest {
  @TempDir Path tempDirectory;

  @Test
  void findsRobotDirectoryWhenRunningFromBackendModule() throws Exception {
    Files.createDirectories(tempDirectory.resolve("robot-framework"));
    String originalUserDirectory = System.getProperty("user.dir");
    try {
      System.setProperty("user.dir", tempDirectory.resolve("rizenic-backend-service").toString());

      assertEquals(
          tempDirectory.resolve("robot-framework/job-json-input").toAbsolutePath().normalize(),
          RobotOutboxService.resolveOutboxDirectory(""));
    } finally {
      System.setProperty("user.dir", originalUserDirectory);
    }
  }
}
