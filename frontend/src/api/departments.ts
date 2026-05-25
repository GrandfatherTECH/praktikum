import { apiRequest } from "./client";
import type { Department, DepartmentCreatePayload, DepartmentUpdatePayload } from "./types";

export function listDepartments() {
  return apiRequest<Department[]>("/departments");
}

export function createDepartment(payload: DepartmentCreatePayload) {
  return apiRequest<Department>("/departments", {
    method: "POST",
    body: payload,
  });
}

export function updateDepartment(departmentId: number, payload: DepartmentUpdatePayload) {
  return apiRequest<Department>(`/departments/${departmentId}`, {
    method: "PATCH",
    body: payload,
  });
}
