package com.rizenic.backend.jobs;

/** Typed request for the inline legacy fast-update contract. */
public final class JobDtos {
    private JobDtos() {}
    public record FastUpdateRequest(String field, Object value) {}
    public record JobCreateRequest(
            String branch_name, String customer_name, String phone_number, String customer_phone, String customer_type,
            String car_plate, String car_brand, String car_model, String vin_no, String car_color,
            String job_status, String department_routing, String sa_owner, String payment_type,
            String damage_level, String notes, String repair_notes, String contact_date,
            String appointment_date, String arrived_date, String target_finish_date,
            String delivery_date, String qt_no, String quotation_no, String so_no, String job_order_no, String bl_no, String epc_no, String ivn_no, String claim_no,
            String main_part_name, String sub_part_name, Object main_part_qty, Object sub_part_qty) {
        public static JobCreateRequest ofMinimal(String branch, String customer, String phone, String plate, String model, String notes, String qt, String so) {
            return new JobCreateRequest(branch, customer, phone, null, null, plate, null, model, null, null, null, null, null, null, null, notes, null, null, null, null, null, null, qt, null, so, null, null, null, null, null, null, null, null, null);
        }
    }
    public record JobUpdateRequest(
            String customer_name, String phone_number, String customer_phone, String customer_type, String car_plate,
            String car_model, String vin_no, String car_color, String job_status,
            String department_routing, String sa_owner, String payment_type, String notes,
            String repair_notes, String contact_date, String appointment_date, String arrived_date,
            String target_finish_date, String actual_finish_date, String repair_finish_date,
            String delivery_date, String qt_no, String quotation_no, String so_no, String job_order_no, String bl_no, String epc_no, String ivn_no, String claim_no,
            String main_part_name, String sub_part_name, Object main_part_qty, Object sub_part_qty) {}
    public record JobResponse(java.util.Map<String,Object> fields) { @com.fasterxml.jackson.annotation.JsonAnyGetter public java.util.Map<String,Object> jsonFields(){return fields;} }
}
