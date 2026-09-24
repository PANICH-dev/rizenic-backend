package com.rizenic.backend.infrastructure;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebCorsConfig implements WebMvcConfigurer {
  public void addCorsMappings(CorsRegistry registry) {
    String origins =
        System.getenv()
            .getOrDefault(
                "FRONTEND_ORIGINS",
                "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001");
    registry
        .addMapping("/api/**")
        .allowedOrigins(origins.split(","))
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders("X-Request-Id");
  }
}
