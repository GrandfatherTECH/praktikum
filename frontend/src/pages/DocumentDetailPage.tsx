import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Form, Input, List, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  acknowledgeDocument,
  approveDocument,
  downloadDocumentFileUrl,
  generateExtract,
  generateInstruction,
  generateOrder,
  previewDocumentUrl,
  resubmitDocument,
  returnForRevision,
  sendForAcknowledgement,
} from "../api/documents";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "./documentHelpers";
import { useDepartmentsQuery, useDocumentDetailQuery, useUsersQuery } from "./hooks";

export function DocumentDetailPage() {
  const { documentId } = useParams();
  const numericId = Number(documentId);
  const documentQuery = useDocumentDetailQuery(numericId, Number.isFinite(numericId));
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [revisionForm] = Form.useForm<{ comment: string }>();
  const [ackForm] = Form.useForm<{ user_ids: number[]; department_ids: number[] }>();
  const [extractForm] = Form.useForm<{ extracted_items_text: string; certifier_position: string; certifier_name: string; extract_date: string }>();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    await queryClient.invalidateQueries({ queryKey: ["document", numericId] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveDocument(numericId),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Документ согласован" });
    },
  });
  const returnMutation = useMutation({
    mutationFn: (comment: string) => returnForRevision(numericId, { comment }),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Документ возвращен на доработку" });
      setRevisionOpen(false);
    },
  });
  const resubmitMutation = useMutation({
    mutationFn: () => resubmitDocument(numericId),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Документ повторно отправлен" });
    },
  });
  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeDocument(numericId),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Ознакомление подтверждено" });
    },
  });
  const generateMutation = useMutation({
    mutationFn: () => (documentQuery.data?.type === "INSTRUCTION" ? generateInstruction(numericId) : generateOrder(numericId)),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Предпросмотр обновлен" });
    },
  });
  const sendAckMutation = useMutation({
    mutationFn: (values: { user_ids: number[]; department_ids: number[] }) => sendForAcknowledgement(numericId, values),
    onSuccess: async () => {
      await refresh();
      notification.success({ message: "Документ отправлен на ознакомление" });
      setAckOpen(false);
    },
  });
  const extractMutation = useMutation({
    mutationFn: (values: { extracted_items_text: string; certifier_position: string; certifier_name: string; extract_date: string }) =>
      generateExtract(numericId, {
        extracted_items: values.extracted_items_text
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        certifier_position: values.certifier_position,
        certifier_name: values.certifier_name,
        extract_date: values.extract_date,
      }),
    onSuccess: async (document) => {
      await refresh();
      notification.success({ message: "Выписка сформирована" });
      setExtractOpen(false);
      await navigate(`/documents/${document.id}`);
    },
  });

  const userOptions = useMemo(
    () => (usersQuery.data ?? []).map((user) => ({ label: user.full_name, value: user.id })),
    [usersQuery.data],
  );
  const departmentOptions = useMemo(
    () => (departmentsQuery.data ?? []).map((department) => ({ label: department.name, value: department.id })),
    [departmentsQuery.data],
  );

  return (
    <QueryState
      isLoading={documentQuery.isLoading || usersQuery.isLoading || departmentsQuery.isLoading}
      error={documentQuery.error ? getErrorMessage(documentQuery.error) : undefined}
    >
      {documentQuery.data ? (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <Card>
            <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
              <div>
                <Typography.Title level={3}>{documentQuery.data.title}</Typography.Title>
                <Space wrap>
                  <Tag>{DOCUMENT_TYPE_LABELS[documentQuery.data.type]}</Tag>
                  <Tag color="blue">{DOCUMENT_STATUS_LABELS[documentQuery.data.status]}</Tag>
                </Space>
              </div>
              <Space wrap>
                {documentQuery.data.allowed_actions.includes("edit") ? (
                  <Button
                    onClick={() =>
                      void navigate(
                        documentQuery.data.type === "ORDER"
                          ? `/documents/orders/${documentQuery.data.id}/edit`
                          : `/documents/instructions/${documentQuery.data.id}/edit`,
                      )
                    }
                  >
                    Редактировать
                  </Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("generate") ? (
                  <Button loading={generateMutation.isPending} onClick={() => void generateMutation.mutateAsync()}>
                    Сформировать
                  </Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("approve") ? (
                  <Button type="primary" loading={approveMutation.isPending} onClick={() => void approveMutation.mutateAsync()}>
                    Согласовать
                  </Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("return_for_revision") ? (
                  <Button danger onClick={() => setRevisionOpen(true)}>
                    Вернуть на доработку
                  </Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("resubmit") ? (
                  <Button loading={resubmitMutation.isPending} onClick={() => void resubmitMutation.mutateAsync()}>
                    Повторно отправить
                  </Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("send_for_acknowledgement") ? (
                  <Button onClick={() => setAckOpen(true)}>Отправить на ознакомление</Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("acknowledge") ? (
                  <Button onClick={() => void acknowledgeMutation.mutateAsync()}>Ознакомлен</Button>
                ) : null}
                {documentQuery.data.allowed_actions.includes("generate_extract") ? (
                  <Button onClick={() => setExtractOpen(true)}>Сформировать выписку</Button>
                ) : null}
              </Space>
            </Space>
          </Card>

          <Card title="Метаданные">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Автор">{documentQuery.data.author?.full_name ?? documentQuery.data.author_id}</Descriptions.Item>
              <Descriptions.Item label="Отдел">{documentQuery.data.department?.name ?? "Не указан"}</Descriptions.Item>
              <Descriptions.Item label="Дата документа">{documentQuery.data.document_date ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Номер">{documentQuery.data.registered_number ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Организация">{documentQuery.data.organization_name}</Descriptions.Item>
              <Descriptions.Item label="Подписант">{`${documentQuery.data.signer_position}, ${documentQuery.data.signer_name}`}</Descriptions.Item>
              <Descriptions.Item label="Исполнитель">{documentQuery.data.executor_name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Телефон">{documentQuery.data.executor_phone ?? "-"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Структурированные данные">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(documentQuery.data.structured_data, null, 2)}</pre>
          </Card>

          <Card title="Маршрут согласования">
            <List
              dataSource={documentQuery.data.approval_steps}
              renderItem={(item) => (
                <List.Item>
                  {item.step_order}. {item.approver?.full_name ?? item.approver_id} - {item.status}
                  {item.comment ? ` (${item.comment})` : ""}
                </List.Item>
              )}
            />
          </Card>

          <Card title="Лист ознакомления">
            <List
              dataSource={documentQuery.data.acknowledgements}
              renderItem={(item) => (
                <List.Item>
                  {item.user?.full_name ?? item.user_id} - {item.status}
                </List.Item>
              )}
            />
          </Card>

          <Card title="Файлы">
            <Table
              rowKey="id"
              pagination={false}
              dataSource={documentQuery.data.files}
              columns={[
                { title: "Имя", dataIndex: "original_filename", key: "original_filename" },
                { title: "Тип", dataIndex: "kind", key: "kind" },
                { title: "Размер", dataIndex: "size_bytes", key: "size_bytes" },
                {
                  title: "Действия",
                  key: "actions",
                  render: (_, record) =>
                    record.is_download_allowed ? (
                      <Button href={downloadDocumentFileUrl(documentQuery.data!.id, record.id)}>Скачать</Button>
                    ) : (
                      <Typography.Text type="secondary">Только защищенный просмотр</Typography.Text>
                    ),
                },
              ]}
            />
          </Card>

          <Card title="Предпросмотр PDF">
            <iframe
              title="PDF Preview"
              src={previewDocumentUrl(documentQuery.data.id)}
              style={{ width: "100%", minHeight: 720, border: "1px solid #d9d9d9", borderRadius: 8 }}
            />
          </Card>

          <Modal title="Вернуть на доработку" open={revisionOpen} onCancel={() => setRevisionOpen(false)} onOk={() => revisionForm.submit()}>
            <Form form={revisionForm} layout="vertical" onFinish={async (values) => returnMutation.mutateAsync(values.comment)}>
              <Form.Item label="Комментарий" name="comment" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal title="Отправить на ознакомление" open={ackOpen} onCancel={() => setAckOpen(false)} onOk={() => ackForm.submit()}>
            <Form form={ackForm} layout="vertical" onFinish={async (values) => sendAckMutation.mutateAsync(values)}>
              <Form.Item label="Пользователи" name="user_ids">
                <Select mode="multiple" options={userOptions} />
              </Form.Item>
              <Form.Item label="Отделы" name="department_ids">
                <Select mode="multiple" options={departmentOptions} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal title="Сформировать выписку" open={extractOpen} onCancel={() => setExtractOpen(false)} onOk={() => extractForm.submit()}>
            <Form form={extractForm} layout="vertical" onFinish={async (values) => extractMutation.mutateAsync(values)}>
              <Form.Item label="Пункты выписки" name="extracted_items_text" rules={[{ required: true }]}>
                <Input.TextArea rows={6} placeholder="Каждый пункт с новой строки" />
              </Form.Item>
              <Form.Item label="Должность заверяющего" name="certifier_position" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="ФИО заверяющего" name="certifier_name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Дата выписки" name="extract_date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      ) : null}
    </QueryState>
  );
}
