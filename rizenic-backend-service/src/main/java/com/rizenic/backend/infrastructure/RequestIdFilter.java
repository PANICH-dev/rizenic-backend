package com.rizenic.backend.infrastructure;

import jakarta.servlet.*;
import java.io.IOException;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class RequestIdFilter implements Filter {
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    var http = (jakarta.servlet.http.HttpServletResponse) response;
    String id = UUID.randomUUID().toString();
    http.setHeader("X-Request-Id", id);
    chain.doFilter(request, response);
  }
}
