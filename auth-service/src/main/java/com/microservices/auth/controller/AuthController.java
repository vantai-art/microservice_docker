package com.microservices.auth.controller;

import com.microservices.auth.dto.*;
import com.microservices.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // ─── Public ──────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Boolean>> validateToken(@RequestParam String token) {
        return ResponseEntity.ok(Map.of("valid", authService.validateToken(token)));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "auth-service"));
    }

    // ─── Authenticated User ──────────────────────────────

    @GetMapping("/profile")
    public ResponseEntity<UserInfoDto> getProfile(@RequestHeader("X-User-Email") String email) {
        return ResponseEntity.ok(authService.getProfile(email));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserInfoDto> updateProfile(
        @RequestHeader("X-User-Email") String email,
        @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(authService.updateProfile(email, request));
    }

    // ─── Admin Only ──────────────────────────────────────

    @GetMapping("/admin/users")
    public ResponseEntity<List<UserInfoDto>> getAllUsers(
        @RequestHeader("X-User-Role") String role
    ) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(authService.getAllUsers());
    }

    @PutMapping("/admin/users/{userId}/role")
    public ResponseEntity<UserInfoDto> changeRole(
        @PathVariable Long userId,
        @RequestParam String role,
        @RequestHeader("X-User-Role") String callerRole
    ) {
        if (!"ADMIN".equals(callerRole)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(authService.changeRole(userId, role));
    }

    @PutMapping("/admin/users/{userId}/toggle")
    public ResponseEntity<UserInfoDto> toggleActive(
        @PathVariable Long userId,
        @RequestHeader("X-User-Role") String callerRole
    ) {
        if (!"ADMIN".equals(callerRole)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(authService.toggleActive(userId));
    }
}
