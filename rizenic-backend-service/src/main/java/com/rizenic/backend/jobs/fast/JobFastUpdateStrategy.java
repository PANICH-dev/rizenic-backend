package com.rizenic.backend.jobs.fast;

public interface JobFastUpdateStrategy {
  boolean supports(String field);

  String update(Long jobId, String field, Object value);
}
