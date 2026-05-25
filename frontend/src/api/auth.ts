import { apiRequest } from "./client";
import type { LoginPayload, LoginResponse, MeResponse } from "./types";

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
