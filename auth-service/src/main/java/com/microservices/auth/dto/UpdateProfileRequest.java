package com.microservices.auth.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String username;
    private String currentPassword;
    private String newPassword;
}