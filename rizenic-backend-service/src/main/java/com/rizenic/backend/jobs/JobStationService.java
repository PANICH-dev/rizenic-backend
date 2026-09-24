package com.rizenic.backend.jobs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JobStationService {
    private final JdbcClient db;
    public JobStationService(JdbcClient db) { this.db = db; }

    public void update(Long jobId, String code, boolean done) {
        var stationId = db.sql("select id from rizenic_new.repair_stations where lower(code)=lower(:c) or lower(name)=lower(:c) limit 1")
                .param("c", code).query(Long.class).optional().orElseGet(() ->
                        db.sql("insert into rizenic_new.repair_stations(code,name) values(:c,:c) on conflict(code) do update set name=excluded.name returning id")
                                .param("c", code).query(Long.class).single());
        db.sql("""
                insert into rizenic_new.job_station_progress(job_id,station_id,state,legacy_checked,updated_at)
                values(:j,:s,:st,:d,now())
                on conflict(job_id,station_id) do update set state=excluded.state,legacy_checked=excluded.legacy_checked,updated_at=now()
                """).param("j", jobId).param("s", stationId)
                .param("st", done ? "COMPLETED" : "NOT_STARTED").param("d", done).update();
    }
}
