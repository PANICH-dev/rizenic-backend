package com.rizenic.backend.infrastructure;

import java.time.Duration;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class SessionTokenService {
  private static final Duration TTL = Duration.ofHours(8);
  private final StringRedisTemplate redis;

  public SessionTokenService(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public String issue(Long employeeId) {
    var token = UUID.randomUUID() + "." + UUID.randomUUID();
    redis.opsForValue().set(key(token), String.valueOf(employeeId), TTL);
    return token;
  }

  public Long employee(String token) {
    var key = key(token);
    var value = redis.opsForValue().get(key);
    if (value == null) return null;
    redis.expire(key, TTL);
    try {
      return Long.valueOf(value);
    } catch (NumberFormatException e) {
      redis.delete(key);
      return null;
    }
  }

  public void revoke(String token) {
    redis.delete(key(token));
  }

  private String key(String token) {
    return "rizenic:session:" + token;
  }
}
