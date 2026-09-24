package com.rizenic.backend.master.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public final class MasterDtos {
    private MasterDtos() {}
    public record Status(@JsonProperty("status_code") String code, @JsonProperty("status_name") String name, String department, @JsonProperty("route_page") String routePage) {}
    public record BrandModel(Long id, @JsonProperty("brand_code") String brandCode, @JsonProperty("brand_name") String brandName, @JsonProperty("model_name") String modelName, @JsonProperty("car_brand") String carBrand, @JsonProperty("car_model") String carModel) {}
    public record Simple(Long id, String code, String name, @JsonProperty("type_code") String typeCode, @JsonProperty("type_name") String typeName, @JsonProperty("customer_type_id") Long customerTypeId) {}
    public record Insurer(Long id, @JsonProperty("insurance_code") String code, @JsonProperty("insurance_name") String name, @JsonProperty("insurance_type") String insuranceType) {}
    public record BodyPart(Long id, String name, String category, @JsonProperty("part_name") String partName, @JsonProperty("category_code") String categoryCode) {}
    public record Employee(Long id, @JsonProperty("employee_code") String employeeCode, @JsonProperty("employee_name") String displayName, String phone, @JsonProperty("home_branch_id") Long homeBranchId, @JsonProperty("branch_name") String branchName, @JsonProperty("employee_role") String employeeRole) {}
    public record StatusRequest(@JsonProperty("status_code") String code, @JsonProperty("status_name") String name, String department, @JsonProperty("route_page") String routePage) {}
    public record BrandModelRequest(@JsonProperty("brand_code") String brandCode, @JsonProperty("brand_name") String brandName, @JsonProperty("model_name") String modelName, @JsonProperty("car_brand") String carBrand, @JsonProperty("car_model") String carModel) { public String resolvedBrand(){return brandName!=null?brandName:carBrand;} public String resolvedModel(){return modelName!=null?modelName:carModel;} }
    public record SimpleRequest(@JsonProperty("code") String code, @JsonProperty("name") String name, @JsonProperty("type_code") String typeCode, @JsonProperty("type_name") String typeName) { public String resolvedCode(){return code!=null?code:typeCode;} public String resolvedName(){return name!=null?name:typeName;} }
    public record InsurerRequest(@JsonProperty("insurance_code") String code, @JsonProperty("insurance_name") String name, @JsonProperty("insurance_type") String insuranceType) {}
    public record BodyPartRequest(String name, @JsonProperty("part_name") String partName, String category) { public String resolvedName(){return name!=null?name:partName;} }
    public record EmployeeRequest(@JsonProperty("employee_code") String employeeCode, @JsonProperty("employee_name") String displayName, String phone, @JsonProperty("home_branch_id") Long homeBranchId, @JsonProperty("branch_name") String branchName, @JsonProperty("employee_role") String employeeRole, String username, String password, @JsonProperty("accessible_pages") String accessiblePages) {}
    public record LoginRequest(String username, String password) {}
}
