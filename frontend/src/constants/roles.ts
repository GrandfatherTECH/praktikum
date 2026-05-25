import type { UserRole } from "../api/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Администратор",
  CHIEF: "Начальник",
  DEPARTMENT_HEAD: "Начальник отдела",
  EMPLOYEE: "Сотрудник",
  INCOMING_DOC_OPERATOR: "Оператор входящей документации",
  PERSONNEL_OFFICE: "Строевая часть",
};

export const ADMIN_ROLES: UserRole[] = ["ADMIN", "CHIEF"];
