import { Card, Space, Table, Typography } from "antd";

import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { useAuditLogsQuery } from "./hooks";

export function AuditLogPage() {
  const auditQuery = useAuditLogsQuery();

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3}>Журнал действий</Typography.Title>
      </Card>
      <Card>
        <QueryState
          isLoading={auditQuery.isLoading}
          error={auditQuery.error ? getErrorMessage(auditQuery.error) : undefined}
          isEmpty={(auditQuery.data?.length ?? 0) === 0}
          emptyDescription="Записей аудита нет"
        >
          <Table
            rowKey="id"
            dataSource={auditQuery.data}
            columns={[
              { title: "Дата", dataIndex: "created_at", key: "created_at" },
              { title: "Пользователь", key: "actor", render: (_, record) => record.actor?.full_name ?? "-" },
              { title: "Действие", dataIndex: "action", key: "action" },
              { title: "Тип сущности", dataIndex: "entity_type", key: "entity_type" },
              { title: "ID", dataIndex: "entity_id", key: "entity_id" },
              { title: "IP", dataIndex: "ip_address", key: "ip_address" },
              { title: "User-Agent", dataIndex: "user_agent", key: "user_agent" },
            ]}
          />
        </QueryState>
      </Card>
    </Space>
  );
}
