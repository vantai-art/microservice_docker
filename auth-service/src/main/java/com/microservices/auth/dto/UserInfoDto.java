package com.microservices.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserInfoDto {
    private Long id;
    private String username;
    private String email;
    private String role;
    private boolean active;
    private String createdAt;
}