package com.rizenic.backend.jobs;

import com.rizenic.backend.jobs.domain.RepairJobQueryPort;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class JdbcRepairJobQueryAdapter implements RepairJobQueryPort {
  private final JdbcClient db;

  public JdbcRepairJobQueryAdapter(JdbcClient db) {
    this.db = db;
  }

  private List<LinkedHashMap<String, Object>> query(String suffix) {
    return db.sql(
            "select j.id id,j.id report_id,j.id job_id,b.name branch_name,c.display_name customer_name,ct.name customer_type,(select cc.raw_value from rizenic_new.customer_contacts cc where cc.customer_id=c.id and cc.contact_type='PHONE' order by cc.is_primary desc,cc.id limit 1) phone_number,e.display_name sa_owner,v.plate_number car_plate,v.vin vin_no,v.color car_color,cm.model_name car_model,cb.name car_brand,js.name job_status,d.name department_routing,j.damage_level,j.payment_label payment_type,j.notes,j.repair_notes,j.contact_on contact_date,j.appointment_on appointment_date,j.intake_on arrived_date,j.target_finish_on target_finish_date,j.actual_finish_on actual_finish_date,j.repair_finished_on repair_finish_date,j.delivery_on delivery_date,case when j.is_parked is true then 'จอดซ่อม' when j.is_parked is false then 'ไม่จอดซ่อม' else null end is_parked,j.created_at,f.labor_amount cost_labor,f.parts_amount cost_part,f.external_amount cost_external,f.billing_on billing_date,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('kho') and sp.state='COMPLETED') station_kho,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('pou') and sp.state='COMPLETED') station_pou,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('puan') and sp.state='COMPLETED') station_puan,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('pon') and sp.state='COMPLETED') station_pon,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('prak') and sp.state='COMPLETED') station_prak,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('kat') and sp.state='COMPLETED') station_kat,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('qc') and sp.state='COMPLETED') station_qc,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('mag') and sp.state='COMPLETED') station_mag,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('kraj') and sp.state='COMPLETED') station_kraj,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('film') and sp.state='COMPLETED') station_film,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('pak') and sp.state='COMPLETED') station_pak,exists(select 1 from rizenic_new.job_station_progress sp join rizenic_new.repair_stations rs on rs.id=sp.station_id where sp.job_id=j.id and lower(replace(rs.code,'STATION_',''))=lower('ready') and sp.state='COMPLETED') station_ready, (select string_agg(x.document_number,',') from rizenic_new.job_documents x where x.job_id=j.id and x.document_type='QT') qt_no,(select string_agg(x.document_number,',') from rizenic_new.job_documents x where x.job_id=j.id and x.document_type='SO') so_no,(select string_agg(x.document_number,',') from rizenic_new.job_documents x where x.job_id=j.id and x.document_type='BL') bl_no,(select string_agg(x.document_number,',') from rizenic_new.job_documents x where x.job_id=j.id and x.document_type='EPC') epc_no,(select string_agg(x.document_number,',') from rizenic_new.job_documents x where x.job_id=j.id and x.document_type='CLAIM') claim_no,(select string_agg(i.description,', ' order by i.sort_order) from rizenic_new.job_repair_items i where i.job_id=j.id and i.category='MAIN') main_part_name,(select coalesce(sum(i.quantity),0) from rizenic_new.job_repair_items i where i.job_id=j.id and i.category='MAIN') main_part_qty,(select string_agg(i.description,', ' order by i.sort_order) from rizenic_new.job_repair_items i where i.job_id=j.id and i.category='SUB') sub_part_name,(select coalesce(sum(i.quantity),0) from rizenic_new.job_repair_items i where i.job_id=j.id and i.category='SUB') sub_part_qty from rizenic_new.repair_jobs j join rizenic_new.branches b on b.id=j.branch_id left join rizenic_new.customers c on c.id=j.customer_id left join rizenic_new.customer_types ct on ct.id=coalesce(j.customer_type_id,c.customer_type_id) left join rizenic_new.employees e on e.id=j.service_advisor_id left join rizenic_new.vehicles v on v.id=j.vehicle_id left join rizenic_new.car_models cm on cm.id=v.car_model_id left join rizenic_new.car_brands cb on cb.id=cm.brand_id left join rizenic_new.job_statuses js on js.id=j.status_id left join rizenic_new.departments d on d.id=j.department_id left join rizenic_new.job_financial_summaries f on f.job_id=j.id where j.archived_at is null "
                + suffix
                + " order by j.id desc")
        .query(
            (r, n) -> {
              var m = new LinkedHashMap<String, Object>();
              for (var k :
                  List.of(
                      "id",
                      "report_id",
                      "job_id",
                      "branch_name",
                      "customer_name",
                      "phone_number",
                      "customer_type",
                      "sa_owner",
                      "car_plate",
                      "vin_no",
                      "car_color",
                      "car_model",
                      "car_brand",
                      "job_status",
                      "department_routing",
                      "damage_level",
                      "payment_type",
                      "notes",
                      "repair_notes",
                      "contact_date",
                      "appointment_date",
                      "arrived_date",
                      "target_finish_date",
                      "actual_finish_date",
                      "repair_finish_date",
                      "delivery_date",
                      "is_parked",
                      "created_at",
                      "cost_labor",
                      "cost_part",
                      "cost_external",
                      "billing_date",
                      "station_kho",
                      "station_pou",
                      "station_puan",
                      "station_pon",
                      "station_prak",
                      "station_kat",
                      "station_qc",
                      "station_mag",
                      "station_kraj",
                      "station_film",
                      "station_pak",
                      "station_ready",
                      "qt_no",
                      "so_no",
                      "bl_no",
                      "epc_no",
                      "claim_no",
                      "main_part_name",
                      "main_part_qty",
                      "sub_part_name",
                      "sub_part_qty")) m.put(k, r.getObject(k));
              return m;
            })
        .list();
  }

  public List<LinkedHashMap<String, Object>> findAll() {
    return query("");
  }

  public Optional<LinkedHashMap<String, Object>> findOne(Long id) {
    // Legacy report IDs are preserved in job_number. Prefer that mapping when
    // both namespaces contain the same numeric value; new callers still work
    // because IDs without a legacy mapping fall back to repair_jobs.id.
    var legacy = query("and j.job_number='LEGACY-" + id + "'").stream().findFirst();
    return legacy.isPresent() ? legacy : query("and j.id=" + id).stream().findFirst();
  }
}
