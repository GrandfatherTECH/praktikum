export type UserRole =
  | "ADMIN"
  | "CHIEF"
  | "DEPARTMENT_HEAD"
  | "EMPLOYEE"
  | "INCOMING_DOC_OPERATOR"
  | "PERSONNEL_OFFICE";

export type User = {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
  department_id: number | null;
  position: string | null;
  is_active: boolean;
  is_approved: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: number;
  name: string;
  head_user_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  user: User;
};

export type MeResponse = {
  user: User;
};

export type UserCreatePayload = {
  full_name: string;
  username: string;
  password: string;
  role: UserRole;
  department_id: number | null;
  position: string | null;
  is_active: boolean;
};

export type UserUpdatePayload = {
  full_name?: string;
  role?: UserRole;
  department_id?: number | null;
  position?: string | null;
  is_active?: boolean;
  is_approved?: boolean;
};

export type ApproveUserResponse = {
  message: string;
  user: User;
};

export type OneTimePasswordResponse = {
  message: string;
  temporary_password: string;
  user: User;
};

export type DepartmentCreatePayload = {
  name: string;
  head_user_id: number | null;
  is_active: boolean;
};

export type DepartmentUpdatePayload = {
  name?: string;
  head_user_id?: number | null;
  is_active?: boolean;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};
