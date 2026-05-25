import { apiRequest } from "./client";
import type { ChangePasswordPayload, LoginPayload, LoginResponse, MeResponse } from "./types";

export function login(payload: LoginPayload) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser() {
  return apiRequest<MeResponse>("/auth/me");
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: payload,
  });
}
