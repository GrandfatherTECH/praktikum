import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Space, Table, Typography } from "antd";

import { completeResolution, takeResolutionInWork } from "../api/documents";
import type { Document } from "../api/types";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { useResolutionsQuery } from "./hooks";

export function ResolutionsPage() {
  const resolutionsQuery = useResolutionsQuery();
  const queryClient = useQueryClient();
  const { notification } = App.useApp();

  const takeMutation = useMutation({
    mutationFn: takeResolutionInWork,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resolutions"] });
      notification.success({ message: "Резолюция взята в работу" });
    },
  });
  const completeMutation = useMutation({
    mutationFn: completeResolution,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resolutions"] });
      notification.success({ message: "Резолюция завершена" });
    },
  });

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3}>Резолюции</Typography.Title>
      </Card>
      <Card>
        <QueryState
          isLoading={resolutionsQuery.isLoading}
          error={resolutionsQuery.error ? getErrorMessage(resolutionsQuery.error) : undefined}
          isEmpty={(resolutionsQuery.data?.length ?? 0) === 0}
          emptyDescription="Резолюций нет"
        >
          <Table
            rowKey="id"
            dataSource={resolutionsQuery.data}
            columns={[
              { title: "Название", dataIndex: "title", key: "title" },
              { title: "Статус", dataIndex: "status", key: "status" },
              { title: "Автор", key: "author", render: (_, record: Document) => record.author?.full_name ?? record.author_id },
              {
                title: "Текст",
                key: "text",
                render: (_, record: Document) => String((record.structured_data as Record<string, unknown>).resolution_text ?? ""),
              },
              {
                title: "Действия",
                key: "actions",
                render: (_, record: Document) => (
                  <Space>
                    <Button onClick={() => void takeMutation.mutateAsync(record.id)}>Взять в работу</Button>
                    <Button onClick={() => void completeMutation.mutateAsync(record.id)}>Завершить</Button>
                  </Space>
                ),
              },
            ]}
          />
        </QueryState>
      </Card>
    </Space>
  );
}
