import type { FormInstance } from "antd";

import { ApiError } from "../api/client";

export function getErrorMessage(error: unknown, fallback = "Не удалось выполнить запрос."): string {
  if (error instanceof ApiError) {
    return error.detail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function applyValidationErrors(form: FormInstance, error: unknown) {
  if (!(error instanceof ApiError) || error.validationErrors.length === 0) {
    return;
  }

  form.setFields(
    error.validationErrors.map((item) => ({
      name: item.loc.filter((part) => part !== "body").map(String),
      errors: [item.msg],
    })),
  );
}
