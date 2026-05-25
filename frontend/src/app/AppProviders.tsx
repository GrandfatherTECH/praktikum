import type { PropsWithChildren } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && "status" in error && error.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: "#a12626",
          colorInfo: "#a12626",
          colorSuccess: "#3d8a58",
          colorWarning: "#b07822",
          borderRadius: 10,
          colorBgLayout: "#0d0d10",
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
