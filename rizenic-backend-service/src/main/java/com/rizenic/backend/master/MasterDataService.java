package com.rizenic.backend.master;

import com.rizenic.backend.master.dto.MasterDtos.*;
import com.rizenic.backend.master.entity.*;
import com.rizenic.backend.master.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import static com.rizenic.backend.master.dto.MasterDtos.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class MasterDataService {
    private final JobStatusRepository statuses; private final DepartmentRepository departments; private final CarBrandRepository brands; private final CarModelRepository models;
    private final CustomerTypeRepository types; private final InsurerRepository insurers; private final BodyPartRepository parts; private final EmployeeRepository employees; private final UserAccountRepository accounts; private final BranchRepository branches; private final JdbcClient jdbc; private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    public MasterDataService(JobStatusRepository statuses, DepartmentRepository departments, CarBrandRepository brands, CarModelRepository models, CustomerTypeRepository types, InsurerRepository insurers, BodyPartRepository parts, EmployeeRepository employees, UserAccountRepository accounts, BranchRepository branches, JdbcClient jdbc) { this.statuses=statuses; this.departments=departments; this.brands=brands; this.models=models; this.types=types; this.insurers=insurers; this.parts=parts; this.employees=employees; this.accounts=accounts; this.branches=branches; this.jdbc=jdbc; }
    @Transactional(readOnly=true) public List<Status> statuses() { var deps=departments.findAll().stream().collect(Collectors.toMap(x->x.id,x->x.name)); return statuses.findByActiveTrueOrderBySortOrderAscCodeAsc().stream().map(s -> new Status(s.code,s.name,deps.get(s.departmentId),s.legacyRoutePage)).toList(); }
    @Transactional(readOnly=true) public List<BrandModel> carModels() { Map<Long,CarBrandEntity> b=brands.findAll().stream().collect(Collectors.toMap(x->x.id,Function.identity())); return models.findByActiveTrueOrderByBrandIdAscModelNameAsc().stream().map(m->{var x=b.get(m.brandId); return new BrandModel(m.id,x==null?null:x.code,x==null?null:x.name,m.modelName,x==null?null:x.name,m.modelName);}).toList(); }
    @Transactional(readOnly=true) public List<Simple> customerTypes() { return types.findByActiveTrueOrderByNameAsc().stream().map(x->new Simple(x.id,x.code,x.name,x.code,x.name,x.id)).toList(); }
    @Transactional(readOnly=true) public List<Insurer> insurers() { return insurers.findByActiveTrueOrderByCodeAsc().stream().map(x->new Insurer(x.id,x.code,x.name,x.insuranceType)).toList(); }
    @Transactional(readOnly=true) public List<BodyPart> bodyParts() { return parts.findByActiveTrueOrderByCategoryAscNameAsc().stream().map(x->new BodyPart(x.id,x.name,legacyCategory(x.category),x.name,x.category)).toList(); }
    @Transactional(readOnly=true) public List<Employee> employees() { return jdbc.sql("""
            SELECT e.id,e.employee_code,e.display_name,e.phone,e.home_branch_id,b.name branch_name,
                   string_agg(DISTINCT r.name, ',') employee_role
            FROM rizenic_new.employees e
            LEFT JOIN rizenic_new.branches b ON b.id=e.home_branch_id
            LEFT JOIN rizenic_new.user_accounts ua ON ua.employee_id=e.id
            LEFT JOIN rizenic_new.user_branch_roles ubr ON ubr.user_id=ua.id
            LEFT JOIN rizenic_new.roles r ON r.id=ubr.role_id
            WHERE e.is_active=true
            GROUP BY e.id,e.employee_code,e.display_name,e.phone,e.home_branch_id,b.name
            ORDER BY e.employee_code
            """).query((row,n)->new Employee(row.getLong("id"),row.getString("employee_code"),row.getString("display_name"),row.getString("phone"),row.getObject("home_branch_id",Long.class),row.getString("branch_name"),row.getString("employee_role"))).list(); }
    private String legacyCategory(String c){return "MAIN".equalsIgnoreCase(c)?"ชิ้นส่วนหลัก":"ชิ้นส่วนรอง";}
    @Transactional public Status saveStatus(StatusRequest r) { if (r.code()==null||r.code().isBlank()||r.name()==null||r.name().isBlank()) throw new IllegalArgumentException("status_code and status_name are required"); var x=statuses.findByCode(r.code()).orElseGet(JobStatusEntity::new); x.code=r.code().trim(); x.name=r.name().trim(); x.legacyRoutePage=r.routePage(); x.active=true; x.sortOrder=x.sortOrder==null?0:x.sortOrder; x.departmentId=departments.findAll().stream().filter(d->r.department()!=null&&d.name.equalsIgnoreCase(r.department().trim())).map(d->d.id).findFirst().orElse(null); statuses.save(x); return new Status(x.code,x.name,r.department(),x.legacyRoutePage); }
    @Transactional public void deleteStatus(Long id) { statuses.findById(id).ifPresent(x->{x.active=false; statuses.save(x);}); }
    @Transactional public void deleteStatusByCode(String code) { statuses.findByCode(code).ifPresent(x->{x.active=false; statuses.save(x);}); }
    @Transactional public BrandModel saveCarModel(Long id, BrandModelRequest r) { var brand=r.resolvedBrand(); var model=r.resolvedModel(); if(brand==null||model==null) throw new IllegalArgumentException("car_brand and car_model are required"); var b=brands.findByCode(brand.trim()).or(()->brands.findByNameIgnoreCase(brand.trim())).orElseGet(()->{var n=new CarBrandEntity(); n.code=brand.trim(); n.name=brand.trim(); n.active=true; return brands.save(n);}); var x=id==null?new CarModelEntity():models.findById(id).orElseThrow(); x.brandId=b.id; x.modelName=model.trim(); x.active=true; models.save(x); return new BrandModel(x.id,b.code,b.name,x.modelName,b.name,x.modelName); }
    @Transactional public void deleteCarModel(Long id) { models.findById(id).ifPresent(x->{x.active=false; models.save(x);}); }
    @Transactional public Simple saveCustomerType(SimpleRequest r) { var code=r.resolvedCode(); var name=r.resolvedName(); if(code==null||name==null) throw new IllegalArgumentException("type_code and type_name are required"); var x=types.findByCode(code).orElseGet(CustomerTypeEntity::new); x.code=code.trim(); x.name=name.trim(); x.active=true; types.save(x); return new Simple(x.id,x.code,x.name,x.code,x.name,x.id); }
    @Transactional public void deleteCustomerType(Long id) { types.findById(id).ifPresent(x->{x.active=false;types.save(x);}); }
    @Transactional public Insurer saveInsurer(InsurerRequest r) { var x=insurers.findByCode(r.code()).orElseGet(InsurerEntity::new); x.code=r.code().trim(); x.name=r.name().trim(); x.insuranceType=r.insuranceType(); x.active=true; insurers.save(x); return new Insurer(x.id,x.code,x.name,x.insuranceType); }
    @Transactional public void deleteInsurer(Long id) { insurers.findById(id).ifPresent(x->{x.active=false;insurers.save(x);}); }
    @Transactional public void deleteInsurerByCode(String code) { insurers.findByCode(code).ifPresent(x->{x.active=false;insurers.save(x);}); }
    @Transactional public BodyPart saveBodyPart(Long id, BodyPartRequest r) { var name=r.resolvedName(); if(name==null||r.category()==null) throw new IllegalArgumentException("part_name and category are required"); var x=id==null?new BodyPartEntity():parts.findById(id).orElseThrow(); x.name=name.trim(); x.category=canonicalCategory(r.category()); x.active=true; parts.save(x); return new BodyPart(x.id,x.name,legacyCategory(x.category),x.name,x.category); }
    private String canonicalCategory(String c){return "ชิ้นส่วนหลัก".equals(c)||"MAIN".equalsIgnoreCase(c)?"MAIN":"SUB";}
    @Transactional public void deleteBodyPart(Long id) { parts.findById(id).ifPresent(x->{x.active=false;parts.save(x);}); }
    @Transactional public Employee saveEmployee(Long id, EmployeeRequest r) { var x=id==null?new EmployeeEntity():employees.findById(id).orElseThrow(); x.employeeCode=r.employeeCode().trim(); x.displayName=r.displayName().trim(); x.phone=r.phone(); x.homeBranchId=r.homeBranchId()!=null?r.homeBranchId():(r.branchName()==null?null:branches.findByNameIgnoreCase(r.branchName()).map(b->b.id).orElse(null)); x.active=true; employees.save(x); if(r.username()!=null&&!r.username().isBlank()){var a=accounts.findByUsernameIgnoreCase(r.username()).orElseGet(UserAccountEntity::new); a.employeeId=x.id; a.username=r.username().trim(); if(r.password()!=null&&!r.password().isBlank())a.passwordHash=passwordEncoder.encode(r.password()); a.credentialState=r.password()==null?"RESET_REQUIRED":"ACTIVE"; accounts.save(a); if(x.homeBranchId!=null&&r.employeeRole()!=null) for(var role:r.employeeRole().split(",")){ jdbc.sql("INSERT INTO rizenic_new.user_branch_roles(user_id,branch_id,role_id) SELECT :u,:b,id FROM rizenic_new.roles WHERE lower(code)=lower(:r) ON CONFLICT DO NOTHING").param("u",a.id).param("b",x.homeBranchId).param("r",role.trim()).update(); } } return new Employee(x.id,x.employeeCode,x.displayName,x.phone,x.homeBranchId,r.branchName(),r.employeeRole()); }
    @Transactional public void deleteEmployee(Long id) { employees.findById(id).ifPresent(x->{x.active=false;employees.save(x);}); }
    @Transactional(readOnly=true) public Map<String,Object> login(LoginRequest request) { var account=accounts.findByUsernameIgnoreCase(request.username()).orElse(null); if (account==null || !"ACTIVE".equals(account.credentialState) || account.passwordHash==null || !passwordEncoder.matches(request.password(),account.passwordHash)) throw new IllegalArgumentException("INVALID_CREDENTIALS"); var employee=employees.findById(account.employeeId).orElseThrow(); var roles=jdbc.sql("select distinct r.code from rizenic_new.user_branch_roles ubr join rizenic_new.roles r on r.id=ubr.role_id where ubr.user_id=:u order by r.code").param("u",account.id).query(String.class).list(); var branches=jdbc.sql("select distinct b.code from rizenic_new.user_branch_roles ubr join rizenic_new.branches b on b.id=ubr.branch_id where ubr.user_id=:u order by b.code").param("u",account.id).query(String.class).list(); return Map.of("success",true,"employee",new Employee(employee.id,employee.employeeCode,employee.displayName,employee.phone,employee.homeBranchId,null,null),"roles",roles,"branches",branches); }
}
