package com.rizenic.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.net.URI; import java.net.http.*; import java.util.*;

@Component
public class LineNotificationGateway implements NotificationGateway {
    private final ObjectMapper json=new ObjectMapper();
    public void sendText(String branch,String message){
        String token=env(branch,"TOKEN"), group=env(branch,"GROUP"); if(token==null||group==null)throw new IllegalArgumentException("ไม่พบสาขาที่ระบุ: "+branch);
        try{var body=json.writeValueAsString(Map.of("to",group,"messages",List.of(Map.of("type","text","text",message))));var req=HttpRequest.newBuilder(URI.create("https://api.line.me/v2/bot/message/push")).header("Content-Type","application/json").header("Authorization","Bearer "+token).POST(HttpRequest.BodyPublishers.ofString(body)).build();var res=HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString());if(res.statusCode()/100!=2)throw new IllegalStateException("ส่ง LINE ไม่สำเร็จ");}catch(Exception e){if(e instanceof IllegalStateException x)throw x;throw new IllegalStateException("ส่ง LINE ไม่สำเร็จ",e);}
    }
    private String env(String branch,String suffix){String key=branch.toLowerCase(Locale.ROOT).contains("rang")?"LINE_RANGSIT_":"LINE_NAVAMIN_";return System.getenv(key+suffix);}
}
