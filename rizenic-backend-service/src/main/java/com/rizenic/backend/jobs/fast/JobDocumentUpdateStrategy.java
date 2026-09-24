package com.rizenic.backend.jobs.fast;
import org.springframework.jdbc.core.simple.JdbcClient; import org.springframework.stereotype.Component; import java.util.*;
@Component public class JobDocumentUpdateStrategy implements JobFastUpdateStrategy {
 private final JdbcClient db; public JobDocumentUpdateStrategy(JdbcClient db){this.db=db;}
 public boolean supports(String f){return List.of("qt_no","so_no","bl_no","epc_no","claim_no","ivn_no").contains(f);}
 public String update(Long id,String field,Object value){String type=switch(field){case "qt_no"->"QT";case "so_no"->"SO";case "bl_no"->"BL";case "epc_no"->"EPC";case "claim_no"->"CLAIM";default->"IVN";};db.sql("delete from rizenic_new.job_documents where job_id=:j and document_type=:t").param("j",id).param("t",type).update();if(value!=null)for(var n:value.toString().split(","))if(!n.isBlank())db.sql("insert into rizenic_new.job_documents(job_id,document_type,document_number) values(:j,:t,:n) on conflict do nothing").param("j",id).param("t",type).param("n",n.trim()).update();return null;}
}
