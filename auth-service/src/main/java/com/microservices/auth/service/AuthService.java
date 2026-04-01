package com.microservices.auth.service;

import com.microservices.auth.dto.AuthResponse;
import com.microservices.auth.dto.LoginRequest;
import com.microservices.auth.dto.RegisterRequest;
import com.microservices.auth.dto.UpdateProfileRequest;
import com.microservices.auth.dto.UserInfoDto;
import com.microservices.auth.model.User;
import com.microservices.auth.repository.UserRepository;
import com.microservices.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LogService logService;

    // ─── Register ────────────────────────────────────────
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail()))
            throw new RuntimeException("Email đã tồn tại");
        if (userRepository.existsByUsername(req.getUsername()))
            throw new RuntimeException("Username đã tồn tại");

        User.Role role = User.Role.USER;
        if (req.getRole() != null) {
            try {
                role = User.Role.valueOf(req.getRole().toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .role(role)
                .active(true)
                .build();

        userRepository.save(user);
        logService.log("REGISTER", "user=" + req.getEmail() + ", role=" + role);

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getUsername());
        return new AuthResponse(token, user.getEmail(), user.getUsername(), user.getRole().name(),
                jwtUtil.getExpirationSeconds());
    }

    // ─── Login ───────────────────────────────────────────
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không đúng"));

        if (!user.isActive())
            throw new RuntimeException("Tài khoản đã bị khóa");

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword()))
            throw new RuntimeException("Email hoặc mật khẩu không đúng");

        logService.log("LOGIN", "user=" + req.getEmail() + ", role=" + user.getRole());
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getUsername());
        return new AuthResponse(token, user.getEmail(), user.getUsername(), user.getRole().name(),
                jwtUtil.getExpirationSeconds());
    }

    // ─── Validate Token ──────────────────────────────────
    public boolean validateToken(String token) {
        return jwtUtil.isTokenValid(token);
    }

    // ─── Get Profile ─────────────────────────────────────
    public UserInfoDto getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return toDto(user);
    }

    // ─── Update Profile ──────────────────────────────────
    public UserInfoDto updateProfile(String email, UpdateProfileRequest req) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            if (!req.getUsername().equals(user.getUsername()) && userRepository.existsByUsername(req.getUsername()))
                throw new RuntimeException("Username đã tồn tại");
            user.setUsername(req.getUsername());
        }

        if (req.getNewPassword() != null && !req.getNewPassword().isBlank()) {
            if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword()))
                throw new RuntimeException("Mật khẩu hiện tại không đúng");
            user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        }

        userRepository.save(user);
        logService.log("UPDATE_PROFILE", "user=" + email);
        return toDto(user);
    }

    // ─── Admin: List All Users ───────────────────────────
    public List<UserInfoDto> getAllUsers() {
        return userRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    // ─── Admin: Change Role ──────────────────────────────
    public UserInfoDto changeRole(Long userId, String newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setRole(User.Role.valueOf(newRole.toUpperCase()));
        userRepository.save(user);
        logService.log("CHANGE_ROLE", "userId=" + userId + ", newRole=" + newRole);
        return toDto(user);
    }

    // ─── Admin: Toggle Active ────────────────────────────
    public UserInfoDto toggleActive(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(!user.isActive());
        userRepository.save(user);
        logService.log("TOGGLE_ACTIVE", "userId=" + userId + ", active=" + user.isActive());
        return toDto(user);
    }

    private UserInfoDto toDto(User u) {
        return new UserInfoDto(u.getId(), u.getUsername(), u.getEmail(),
                u.getRole().name(), u.isActive(), u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
    }
}
