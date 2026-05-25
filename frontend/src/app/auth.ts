import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";

import { changePassword, getCurrentUser, login, logout } from "../api/auth";
import { ApiError } from "../api/client";
import type { ChangePasswordPayload, LoginPayload } from "../api/types";

export const CURRENT_USER_QUERY_KEY = ["auth", "me"];

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => getCurrentUser().then((response) => response.user),
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async (response) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, response.user);
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const { notification } = App.useApp();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      notification.success({
        message: "Выход выполнен",
        description: "Сеанс завершен.",
      });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.detail : "Не удалось выйти из системы.";
      notification.error({
        message: "Ошибка выхода",
        description: message,
      });
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  const { notification } = App.useApp();

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      notification.success({
        message: "Пароль изменен",
        description: "Войдите в систему с новым паролем.",
      });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.detail : "Не удалось изменить пароль.";
      notification.error({
        message: "Ошибка смены пароля",
        description: message,
      });
    },
  });
}
