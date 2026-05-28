import { Button, Card, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";

import type { Document } from "../api/types";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "./documentHelpers";
import { useDocumentsQuery } from "./hooks";

type DocumentsListPageProps = {
  section: "all" | "new" | "current" | "mine" | "archive";
  title: string;
};

export function DocumentsListPage({ section, title }: DocumentsListPageProps) {
  const documentsQuery = useDocumentsQuery(section);
  const navigate = useNavigate();

  const columns: ColumnsType<Document> = [
    {
      title: "Тип",
      key: "type",
      render: (_, record) => DOCUMENT_TYPE_LABELS[record.type],
    },
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "Статус",
      key: "status",
      render: (_, record) => <Tag color={record.requires_action ? "orange" : "blue"}>{DOCUMENT_STATUS_LABELS[record.status]}</Tag>,
    },
    {
      title: "Автор",
      key: "author",
      render: (_, record) => record.author?.full_name ?? `#${record.author_id}`,
    },
    {
      title: "Отдел",
      key: "department",
      render: (_, record) => record.department?.name ?? "Не указан",
    },
    {
      title: "Дата",
      key: "document_date",
      render: (_, record) => record.document_date ?? record.created_at.slice(0, 10),
    },
    {
      title: "Требуется действие",
      key: "requires_action",
      render: (_, record) => (record.requires_action ? <Tag color="red">Да</Tag> : <Tag>Нет</Tag>),
    },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) => (
        <Space wrap>
          <Button onClick={() => void navigate(`/documents/${record.id}`)}>Открыть</Button>
          {record.allowed_actions.includes("edit") ? (
            <Button
              onClick={() =>
                void navigate(
                  record.type === "ORDER"
                    ? `/documents/orders/${record.id}/edit`
                    : record.type === "INSTRUCTION"
                      ? `/documents/instructions/${record.id}/edit`
                      : `/documents/${record.id}`,
                )
              }
            >
              Редактировать
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Title level={3}>{title}</Typography.Title>
            <Typography.Text type="secondary">Реестр документов с действиями по ролям и статусам.</Typography.Text>
          </div>
          <Space wrap>
            <Button type="primary" onClick={() => void navigate("/documents/orders/new")}>
              Создать приказ
            </Button>
            <Button onClick={() => void navigate("/documents/instructions/new")}>Создать приказание</Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <QueryState
          isLoading={documentsQuery.isLoading}
          error={documentsQuery.error ? getErrorMessage(documentsQuery.error) : undefined}
          isEmpty={(documentsQuery.data?.length ?? 0) === 0}
          emptyDescription="Документы не найдены"
        >
          <Table rowKey="id" columns={columns} dataSource={documentsQuery.data} pagination={{ pageSize: 10 }} />
        </QueryState>
      </Card>
    </Space>
  );
}
