import { apiRequest } from "./client";
import type { ApproveUserResponse, OneTimePasswordResponse, User, UserCreatePayload, UserUpdatePayload } from "./types";

export function listUsers() {
  return apiRequest<User[]>("/users");
}

export function createUser(payload: UserCreatePayload) {
  return apiRequest<User>("/users", {
    method: "POST",
    body: payload,
  });
}

export function updateUser(userId: number, payload: UserUpdatePayload) {
  return apiRequest<User>(`/users/${userId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function approveUser(userId: number) {
  return apiRequest<ApproveUserResponse>(`/users/${userId}/approve`, {
    method: "POST",
  });
}

export function deleteUser(userId: number) {
  return apiRequest<{ message: string }>(`/users/${userId}`, {
    method: "DELETE",
  });
}

export function createOneTimePassword(userId: number) {
  return apiRequest<OneTimePasswordResponse>(`/users/${userId}/one-time-password`, {
    method: "POST",
  });
}
