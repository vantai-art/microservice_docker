package com.microservices.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class LogService {

    @Value("${log.service.url:http://log-service:8006}")
    private String logServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Async
    public void log(String action, String detail, int status) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("service", "auth-service");
            body.put("action", action);
            body.put("detail", detail);
            body.put("status", status);
            body.put("level", status >= 400 ? "ERROR" : "INFO");
            body.put("timestamp", Instant.now().toString());
            restTemplate.postForEntity(logServiceUrl + "/api/logs", body, Map.class);
        } catch (Exception e) {
            log.warn("Failed to send log: {}", e.getMessage());
        }
    }

    @Async
    public void log(String action, String detail) {
        log(action, detail, 200);
    }
}
