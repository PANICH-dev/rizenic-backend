package com.rizenic.backend.infrastructure;

import jakarta.servlet.*;
import java.io.IOException;
import org.springframework.stereotype.Component;

/** Validates supplied bearer tokens while keeping legacy unauthenticated aliases compatible. */
@Component
public class BearerTokenFilter implements Filter {
  private final SessionTokenService tokens;

  public BearerTokenFilter(SessionTokenService tokens) {
    this.tokens = tokens;
  }

  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    var req = (jakarta.servlet.http.HttpServletRequest) request;
    var auth = req.getHeader("Authorization");
    if (auth != null && !auth.isBlank()) {
      if (!auth.startsWith("Bearer ")) {
        ((jakarta.servlet.http.HttpServletResponse) response)
            .sendError(401, "Invalid bearer token");
        return;
      }
      var employee = tokens.employee(auth.substring(7).trim());
      if (employee == null) {
        ((jakarta.servlet.http.HttpServletResponse) response)
            .sendError(401, "Invalid or expired token");
        return;
      }
      request.setAttribute("rizenic.employeeId", employee);
    }
    chain.doFilter(request, response);
  }
}
