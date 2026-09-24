package com.rizenic.backend.jobs;

import com.rizenic.backend.jobs.domain.RepairJobPort;
import com.rizenic.backend.jobs.domain.RepairJobQueryPort;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JobsService {
  private final RepairJobPort repo;
  private final RepairJobQueryPort queries;

  public JobsService(RepairJobPort repo, RepairJobQueryPort queries) {
    this.repo = repo;
    this.queries = queries;
  }

  @Transactional(readOnly = true)
  public List<JobDtos.JobResponse> all() {
    return queries.findAll().stream().map(JobDtos.JobResponse::new).toList();
  }

  @Transactional(readOnly = true)
  public JobDtos.JobResponse one(Long id) {
    return new JobDtos.JobResponse(queries.findOne(id).orElseThrow());
  }

  @Transactional
  public Long create(Map<String, Object> x) {
    return repo.create(x);
  }

  @Transactional
  public void update(Long id, Map<String, Object> x) {
    repo.update(id, x);
  }

  @Transactional
  public boolean archive(Long id) {
    return repo.archive(id);
  }

  @Transactional
  public String fast(Long id, String field, Object value) {
    return repo.fast(id, field, value);
  }

  @Transactional
  public void station(Long id, Map<String, Object> x) {
    for (var e : x.entrySet())
      if (e.getKey().startsWith("station_"))
        repo.station(id, e.getKey().substring(8), Boolean.TRUE.equals(e.getValue()));
    repo.update(id, x);
  }
}
