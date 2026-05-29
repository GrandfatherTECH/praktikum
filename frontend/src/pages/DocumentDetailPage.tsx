import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
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
import type { Acknowledgement, ApprovalStep } from "../api/types";
import { MarkdownPreview } from "../components/MarkdownEditor";
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
  const structuredData = documentQuery.data?.structured_data ?? {};
  const latestRevisionComment = useMemo(() => {
    if (!documentQuery.data || documentQuery.data.type !== "ORDER") {
      return null;
    }
    const returnedSteps = documentQuery.data.approval_steps.filter((step) => step.status === "RETURNED" && step.comment?.trim());
    if (returnedSteps.length === 0) {
      return null;
    }
    return returnedSteps[returnedSteps.length - 1].comment ?? null;
  }, [documentQuery.data]);
  const approvalStepsPreview = useMemo<ApprovalStep[]>(() => {
    if (!documentQuery.data) {
      return [];
    }
    if (documentQuery.data.approval_steps.length > 0) {
      return documentQuery.data.approval_steps;
    }
    const approvalIds = Array.isArray(structuredData.approval_people) ? (structuredData.approval_people as number[]) : [];
    return approvalIds.map((approverId, index) => {
      const approver = usersQuery.data?.find((user) => user.id === approverId) ?? null;
      return {
        id: -1_000_000 - approverId - index,
        step_order: index + 1,
        approver_id: approverId,
        status: (index === 0 ? "WAITING" : "PENDING") as ApprovalStep["status"],
        comment: null,
        acted_at: null,
        approver,
      };
    });
  }, [documentQuery.data, structuredData.approval_people, usersQuery.data]);
  const acknowledgementsPreview = useMemo<Acknowledgement[]>(() => {
    if (!documentQuery.data) {
      return [];
    }
    if (documentQuery.data.type !== "ORDER") {
      return [];
    }
    if (documentQuery.data.acknowledgements.length > 0) {
      return documentQuery.data.acknowledgements;
    }
    const acknowledgementIds = Array.isArray(structuredData.acknowledgement_people)
      ? (structuredData.acknowledgement_people as number[])
      : [];
    return acknowledgementIds.map((userId, index) => {
      const user = usersQuery.data?.find((item) => item.id === userId) ?? null;
      return {
        id: -2_000_000 - userId - index,
        user_id: userId,
        status: "PENDING" as Acknowledgement["status"],
        acknowledged_at: null,
        user,
      };
    });
  }, [documentQuery.data, structuredData.acknowledgement_people, usersQuery.data]);

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
              <Descriptions.Item label="Город">{documentQuery.data.city}</Descriptions.Item>
              <Descriptions.Item label="Организация">{documentQuery.data.organization_name}</Descriptions.Item>
              <Descriptions.Item label="Подписант">{`${documentQuery.data.signer_position}, ${documentQuery.data.signer_name}`}</Descriptions.Item>
              {documentQuery.data.type === "ORDER" ? (
                <>
                  <Descriptions.Item label="Исполнитель">{documentQuery.data.executor_name ?? "-"}</Descriptions.Item>
                  <Descriptions.Item label="Телефон">{documentQuery.data.executor_phone ?? "-"}</Descriptions.Item>
                </>
              ) : null}
            </Descriptions>
          </Card>

          <Card title="Содержимое документа">
            {renderStructuredDocument(documentQuery.data.type, structuredData)}
          </Card>

          {documentQuery.data.type === "ORDER" ? (
            <>
              {latestRevisionComment ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Комментарий к доработке"
                  description={latestRevisionComment}
                />
              ) : null}
              <Card title="Статус согласования">
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={approvalStepsPreview}
                  columns={[
                    { title: "Шаг", dataIndex: "step_order", key: "step_order", width: 80 },
                    {
                      title: "Согласующий",
                      key: "approver",
                      render: (_, record) => record.approver?.full_name ?? `Пользователь #${record.approver_id}`,
                    },
                    { title: "Статус", dataIndex: "status", key: "status", width: 180 },
                    { title: "Комментарий", dataIndex: "comment", key: "comment" },
                  ]}
                />
              </Card>

              <Card title="Статус ознакомления">
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={acknowledgementsPreview}
                  columns={[
                    {
                      title: "Сотрудник",
                      key: "user",
                      render: (_, record) => record.user?.full_name ?? `Пользователь #${record.user_id}`,
                    },
                    {
                      title: "Должность",
                      key: "position",
                      render: (_, record) => record.user?.position ?? "-",
                    },
                    { title: "Статус", dataIndex: "status", key: "status", width: 180 },
                    { title: "Дата", dataIndex: "acknowledged_at", key: "acknowledged_at", width: 200 },
                  ]}
                />
              </Card>
            </>
          ) : null}

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
              className="document-preview-frame"
              style={{ width: "100%", minHeight: 720 }}
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

function renderStructuredDocument(documentType: string, structuredData: Record<string, unknown>) {
  if (documentType === "ORDER") {
    const orderItems = Array.isArray(structuredData.order_items) ? structuredData.order_items : [];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Тема приказа">{String(structuredData.order_subject ?? "-")}</Descriptions.Item>
          <Descriptions.Item label="Правовое основание">
            <MarkdownPreview content={String(structuredData.legal_basis_text ?? "")} />
          </Descriptions.Item>
          <Descriptions.Item label="Цель">
            <MarkdownPreview content={String(structuredData.purpose_text ?? "")} />
          </Descriptions.Item>
          <Descriptions.Item label="Контроль исполнения">{String(structuredData.control_assignee_text ?? "-")}</Descriptions.Item>
        </Descriptions>
        <Table
          rowKey={(record) => String(record.key)}
          pagination={false}
          dataSource={orderItems.map((item, index) => ({ key: index + 1, index: index + 1, text: String(item) }))}
          columns={[
            { title: "№", dataIndex: "index", key: "index", width: 80 },
            {
              title: "Пункт приказа",
              dataIndex: "text",
              key: "text",
              render: (value: string) => <MarkdownPreview content={value} />,
            },
          ]}
        />
      </Space>
    );
  }

  if (documentType === "INSTRUCTION") {
    const instructionItems = Array.isArray(structuredData.instruction_items) ? structuredData.instruction_items : [];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Тема">{String(structuredData.instruction_subject ?? "-")}</Descriptions.Item>
          <Descriptions.Item label="Цель">
            <MarkdownPreview content={String(structuredData.purpose_text ?? "")} />
          </Descriptions.Item>
          <Descriptions.Item label="Контроль исполнения">{String(structuredData.control_assignee_text ?? "-")}</Descriptions.Item>
        </Descriptions>
        <Table
          rowKey={(record) => String(record.key)}
          pagination={false}
          dataSource={instructionItems.map((item, index) => ({ key: index + 1, index: index + 1, text: String(item) }))}
          columns={[
            { title: "№", dataIndex: "index", key: "index", width: 80 },
            {
              title: "Пункт приказания",
              dataIndex: "text",
              key: "text",
              render: (value: string) => <MarkdownPreview content={value} />,
            },
          ]}
        />
      </Space>
    );
  }

  return <pre className="document-structured-json">{JSON.stringify(structuredData, null, 2)}</pre>;
}
