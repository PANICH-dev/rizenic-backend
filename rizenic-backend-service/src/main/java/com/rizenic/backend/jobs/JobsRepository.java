package com.rizenic.backend.jobs;

import com.rizenic.backend.jobs.domain.RepairJobPort;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JobsRepository implements RepairJobPort {
  private final JdbcClient db;
  private final JobFastUpdateService fastUpdates;
  private final JobDocumentService documentService;
  private final JobStationService stationService;
  private final JobCustomerService customerService;
  private final JobVehicleService vehicleService;
  private final JobFinanceService financeService;

  public JobsRepository(
      JdbcClient db,
      JobFastUpdateService fastUpdates,
      JobDocumentService documentService,
      JobStationService stationService,
      JobCustomerService customerService,
      JobVehicleService vehicleService,
      JobFinanceService financeService) {
    this.db = db;
    this.fastUpdates = fastUpdates;
    this.documentService = documentService;
    this.stationService = stationService;
    this.customerService = customerService;
    this.vehicleService = vehicleService;
    this.financeService = financeService;
  }

  private Long branch(Object n) {
    if (n != null && !n.toString().isBlank()) {
      var found =
          db.sql(
                  "select id from rizenic_new.branches where lower(name)=lower(:n) or lower(code)=lower(:n) limit 1")
              .param("n", n.toString().trim())
              .query(Long.class)
              .optional();
      if (found.isPresent()) return found.get();
    }
    return db.sql("select id from rizenic_new.branches order by id limit 1")
        .query(Long.class)
        .single();
  }

  private Long resolveJobId(Long requestedId) {
    return db.sql("""
            select id
            from rizenic_new.repair_jobs
            where job_number=:legacy or id=:id
            order by case when job_number=:legacy then 0 else 1 end, id
            limit 1
            """)
        .param("legacy", "LEGACY-" + requestedId)
        .param("id", requestedId)
        .query(Long.class)
        .optional()
        .orElse(requestedId);
  }

  private Object date(Object v) {
    if (v == null || v.toString().isBlank()) return null;
    return v instanceof LocalDate ? v : LocalDate.parse(v.toString());
  }

  private Long status(Object v) {
    return v == null
        ? null
        : db.sql("select id from rizenic_new.job_statuses where name=:v or code=:v limit 1")
            .param("v", v)
            .query(Long.class)
            .optional()
            .orElse(null);
  }

  private Long department(Object v) {
    return v == null
        ? null
        : db.sql("select id from rizenic_new.departments where name=:v or code=:v limit 1")
            .param("v", v)
            .query(Long.class)
            .optional()
            .orElse(null);
  }

  private Long employee(Object v) {
    return v == null
        ? null
        : db.sql(
                "select id from rizenic_new.employees where display_name=:v or employee_code=:v limit 1")
            .param("v", v)
            .query(Long.class)
            .optional()
            .orElse(null);
  }

  private boolean parked(Object v) {
    return v != null
        && (("จอดซ่อม".equalsIgnoreCase(v.toString())) || Boolean.parseBoolean(v.toString()));
  }

  private void items(Long job, Map<String, Object> x) {
    for (var spec :
        new Object[][] {
          {"MAIN", x.get("main_part_name"), x.get("main_part_qty")},
          {"SUB", x.get("sub_part_name"), x.get("sub_part_qty")}
        }) {
      if (spec[1] != null && !spec[1].toString().isBlank())
        db.sql(
                "insert into rizenic_new.job_repair_items(job_id,category,description,quantity) values(:j,:c,:d,:q)")
            .param("j", job)
            .param("c", spec[0])
            .param("d", spec[1])
            .param("q", spec[2] == null ? 1 : spec[2])
            .update();
    }
  }

  public Long create(Map<String, Object> x) {
    var b = branch(x.get("branch_name"));
    var c = customerService.resolve(x);
    var v = vehicleService.resolve(x);
    var id =
        db.sql(
                "insert into rizenic_new.repair_jobs(branch_id,customer_id,vehicle_id,service_advisor_id,status_id,department_id,customer_type_id,damage_level,payment_label,notes,repair_notes,contact_on,appointment_on,intake_on,target_finish_on,actual_finish_on,repair_finished_on,delivery_on,is_parked) values(:b,:c,:v,:sa,:st,:dep,:ct,:damage,:pay,:notes,:repair,:contact,:appt,:arrived,:target,:actual,:repairfinish,:delivery,:parked) returning id")
            .param("b", b)
            .param("c", c)
            .param("v", v)
            .param("sa", employee(x.get("sa_owner")))
            .param("st", status(x.get("job_status")))
            .param("dep", department(x.get("department_routing")))
            .param(
                "ct",
                db.sql("select id from rizenic_new.customer_types where name=:v or code=:v limit 1")
                    .param("v", x.get("customer_type"))
                    .query(Long.class)
                    .optional()
                    .orElse(null))
            .param("damage", x.get("damage_level"))
            .param("pay", x.get("payment_type"))
            .param("notes", x.get("notes"))
            .param("repair", x.get("repair_notes"))
            .param("contact", date(x.get("contact_date")))
            .param("appt", date(x.get("appointment_date")))
            .param("arrived", date(x.get("arrived_date")))
            .param("target", date(x.get("target_finish_date")))
            .param("actual", date(x.get("actual_finish_date")))
            .param("repairfinish", date(x.get("repair_finish_date")))
            .param("delivery", date(x.get("delivery_date")))
            .param("parked", x.get("is_parked") == null ? null : parked(x.get("is_parked")))
            .query(Long.class)
            .single();
    documentService.replace(id, x.get("qt_no"), "QT");
    documentService.replace(id, x.get("so_no"), "SO");
    documentService.replace(id, x.get("bl_no"), "BL");
    documentService.replace(id, x.get("epc_no"), "EPC");
    documentService.replace(id, x.get("claim_no"), "CLAIM");
    items(id, x);
    financeService.save(id, x);
    return id;
  }

  public void update(Long id, Map<String, Object> x) {
    id = resolveJobId(id);
    db.sql(
            "update rizenic_new.repair_jobs set service_advisor_id=coalesce(:sa,service_advisor_id),status_id=coalesce(:st,status_id),department_id=coalesce(:dep,department_id),customer_type_id=coalesce(:ct,customer_type_id),notes=coalesce(:notes,notes),repair_notes=coalesce(:repair_notes,repair_notes),damage_level=coalesce(:damage,damage_level),payment_label=coalesce(:payment,payment_label),contact_on=coalesce(:contact,contact_on),appointment_on=coalesce(:appt,appointment_on),intake_on=coalesce(:arrived,intake_on),target_finish_on=coalesce(:target,target_finish_on),actual_finish_on=coalesce(:actual,actual_finish_on),repair_finished_on=coalesce(:repairfinish,repair_finished_on),delivery_on=coalesce(:delivery,delivery_on),is_parked=coalesce(:parked,is_parked) where id=:id")
        .param("id", id)
        .param("sa", employee(x.get("sa_owner")))
        .param("st", status(x.get("job_status")))
        .param("dep", department(x.get("department_routing")))
        .param(
            "ct",
            x.get("customer_type") == null
                ? null
                : db.sql(
                        "select id from rizenic_new.customer_types where name=:v or code=:v limit 1")
                    .param("v", x.get("customer_type"))
                    .query(Long.class)
                    .optional()
                    .orElse(null))
        .param("notes", x.get("notes"))
        .param("repair_notes", x.get("repair_notes"))
        .param("damage", x.get("damage_level"))
        .param("payment", x.get("payment_type"))
        .param("contact", date(x.get("contact_date")))
        .param("appt", date(x.get("appointment_date")))
        .param("arrived", date(x.get("arrived_date")))
        .param("target", date(x.get("target_finish_date")))
        .param("actual", date(x.get("actual_finish_date")))
        .param("repairfinish", date(x.get("repair_finish_date")))
        .param("delivery", date(x.get("delivery_date")))
        .param("parked", x.get("is_parked") == null ? null : parked(x.get("is_parked")))
        .update();
    if (x.get("customer_name") != null)
      fastUpdates.update(id, "customer_name", x.get("customer_name"));
    if (x.get("phone_number") != null)
      fastUpdates.update(id, "phone_number", x.get("phone_number"));
    if (x.get("car_plate") != null) fastUpdates.update(id, "car_plate", x.get("car_plate"));
    if (x.get("vin_no") != null) fastUpdates.update(id, "vin_no", x.get("vin_no"));
    if (x.get("car_color") != null) fastUpdates.update(id, "car_color", x.get("car_color"));
    documentService.replace(id, x.get("qt_no"), "QT");
    documentService.replace(id, x.get("so_no"), "SO");
    documentService.replace(id, x.get("bl_no"), "BL");
    documentService.replace(id, x.get("epc_no"), "EPC");
    documentService.replace(id, x.get("claim_no"), "CLAIM");
    if (x.containsKey("main_part_name") || x.containsKey("sub_part_name")) {
      db.sql("delete from rizenic_new.job_repair_items where job_id=:j").param("j", id).update();
      items(id, x);
    }
  }

  public boolean archive(Long id) {
    id = resolveJobId(id);
    return db.sql(
                "update rizenic_new.repair_jobs set archived_at=now() where id=:id and archived_at is null")
            .param("id", id)
            .update()
        > 0;
  }

  public String fast(Long id, String field, Object value) {
    return fastUpdates.update(resolveJobId(id), field, value);
  }

  public void station(Long job, String code, boolean done) {
    stationService.update(resolveJobId(job), code, done);
  }
}
