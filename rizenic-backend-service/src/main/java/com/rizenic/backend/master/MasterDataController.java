package com.rizenic.backend.master;

import com.rizenic.backend.master.dto.MasterDtos.*;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
public class MasterDataController {
  private final MasterDataService service;

  public MasterDataController(MasterDataService service) {
    this.service = service;
  }

  @GetMapping("/statuses")
  public List<Status> statuses() {
    return service.statuses();
  }

  @GetMapping("/car-models")
  public List<BrandModel> carModels() {
    return service.carModels();
  }

  @GetMapping("/customer-types")
  public List<Simple> customerTypes() {
    return service.customerTypes();
  }

  @GetMapping("/insurances")
  public List<Insurer> insurers() {
    return service.insurers();
  }

  @GetMapping("/body-parts")
  public List<BodyPart> bodyParts() {
    return service.bodyParts();
  }

  @GetMapping("/employees")
  public List<Employee> employees() {
    return service.employees();
  }

  @PostMapping("/statuses")
  public Status saveStatus(@RequestBody StatusRequest r) {
    return service.saveStatus(r);
  }

  @DeleteMapping("/statuses/{code}")
  public Map<String, Object> deleteStatus(@PathVariable String code) {
    service.deleteStatusByCode(code);
    return Map.of("success", true);
  }

  @PostMapping("/car-models")
  public BrandModel saveModel(@RequestBody BrandModelRequest r) {
    return service.saveCarModel(null, r);
  }

  @PutMapping("/car-models/{id}")
  public BrandModel updateModel(@PathVariable Long id, @RequestBody BrandModelRequest r) {
    return service.saveCarModel(id, r);
  }

  @DeleteMapping("/car-models/{id}")
  public Map<String, Object> deleteModel(@PathVariable Long id) {
    service.deleteCarModel(id);
    return Map.of("success", true);
  }

  @PostMapping("/customer-types")
  public Simple saveType(@RequestBody SimpleRequest r) {
    return service.saveCustomerType(r);
  }

  @PutMapping("/customer-types/{id}")
  public Simple updateType(@PathVariable Long id, @RequestBody SimpleRequest r) {
    return service.saveCustomerType(r);
  }

  @DeleteMapping("/customer-types/{id}")
  public Map<String, Object> deleteType(@PathVariable Long id) {
    service.deleteCustomerType(id);
    return Map.of("success", true);
  }

  @PostMapping("/insurances")
  public Insurer saveInsurer(@RequestBody InsurerRequest r) {
    return service.saveInsurer(r);
  }

  @PutMapping("/insurances/{code}")
  public Insurer updateInsurer(@PathVariable String code, @RequestBody InsurerRequest r) {
    return service.saveInsurer(new InsurerRequest(code, r.name(), r.insuranceType()));
  }

  @DeleteMapping("/insurances/{code}")
  public Map<String, Object> deleteInsurer(@PathVariable String code) {
    service.deleteInsurerByCode(code);
    return Map.of("success", true);
  }

  @PostMapping("/body-parts")
  public BodyPart savePart(@RequestBody BodyPartRequest r) {
    return service.saveBodyPart(null, r);
  }

  @PutMapping("/body-parts/{id}")
  public BodyPart updatePart(@PathVariable Long id, @RequestBody BodyPartRequest r) {
    return service.saveBodyPart(id, r);
  }

  @DeleteMapping("/body-parts/{id}")
  public Map<String, Object> deletePart(@PathVariable Long id) {
    service.deleteBodyPart(id);
    return Map.of("success", true);
  }

  @PostMapping("/employees")
  public Employee saveEmployee(@RequestBody EmployeeRequest r) {
    return service.saveEmployee(null, r);
  }

  @PutMapping("/employees/{id}")
  public Employee updateEmployee(@PathVariable Long id, @RequestBody EmployeeRequest r) {
    return service.saveEmployee(id, r);
  }

  @DeleteMapping("/employees/{id}")
  public Map<String, Object> deleteEmployee(@PathVariable Long id) {
    service.deleteEmployee(id);
    return Map.of("success", true);
  }
}
