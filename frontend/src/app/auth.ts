import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";

import { getCurrentUser, login, logout } from "../api/auth";
import { ApiError } from "../api/client";
import type { LoginPayload } from "../api/types";

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
