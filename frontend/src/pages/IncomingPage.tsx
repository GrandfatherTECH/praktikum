import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Typography } from "antd";
import { useMemo, useState } from "react";

import { createIncoming, createResolution } from "../api/documents";
import type { Document, IncomingPayload, ResolutionPayload } from "../api/types";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { useDepartmentsQuery, useIncomingQuery, useUsersQuery } from "./hooks";

export function IncomingPage() {
  const incomingQuery = useIncomingQuery();
  const departmentsQuery = useDepartmentsQuery();
  const usersQuery = useUsersQuery();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resolutionFor, setResolutionFor] = useState<Document | null>(null);
  const [createForm] = Form.useForm<IncomingPayload>();
  const [resolutionForm] = Form.useForm<ResolutionPayload>();

  const departmentOptions = useMemo(
    () => (departmentsQuery.data ?? []).map((department) => ({ label: department.name, value: department.id })),
    [departmentsQuery.data],
  );
  const userOptions = useMemo(
    () => (usersQuery.data ?? []).map((user) => ({ label: user.full_name, value: user.id })),
    [usersQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: createIncoming,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["incoming"] });
      notification.success({ message: "Входящий документ создан" });
      setCreateOpen(false);
    },
  });

  const resolutionMutation = useMutation({
    mutationFn: ({ incomingId, payload }: { incomingId: number; payload: ResolutionPayload }) => createResolution(incomingId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["incoming"] });
      await queryClient.invalidateQueries({ queryKey: ["resolutions"] });
      notification.success({ message: "Резолюция создана" });
      setResolutionFor(null);
    },
  });

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Title level={3}>Входящая документация</Typography.Title>
            <Typography.Text type="secondary">Реестр входящих документов и создание резолюций.</Typography.Text>
          </div>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Создать входящий документ
          </Button>
        </Space>
      </Card>
      <Card>
        <QueryState
          isLoading={incomingQuery.isLoading}
          error={incomingQuery.error ? getErrorMessage(incomingQuery.error) : undefined}
          isEmpty={(incomingQuery.data?.length ?? 0) === 0}
          emptyDescription="Записей нет"
        >
          <Table
            rowKey="id"
            dataSource={incomingQuery.data}
            columns={[
              { title: "Название", dataIndex: "title", key: "title" },
              { title: "Статус", dataIndex: "status", key: "status" },
              { title: "Отправитель", key: "sender", render: (_, record) => String((record.structured_data as Record<string, unknown>).sender ?? "-") },
              {
                title: "Действия",
                key: "actions",
                render: (_, record) => <Button onClick={() => setResolutionFor(record)}>Создать резолюцию</Button>,
              },
            ]}
          />
        </QueryState>
      </Card>

      <Modal title="Новый входящий документ" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()}>
        <Form form={createForm} layout="vertical" onFinish={async (values) => createMutation.mutateAsync(values)}>
          <Form.Item label="Название" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Дата документа" name="document_date">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Отдел" name="department_id">
            <Select allowClear options={departmentOptions} />
          </Form.Item>
          <Form.Item label="Организация" name="organization_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Должность подписанта" name="signer_position" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="ФИО подписанта" name="signer_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Отправитель" name={["structured_data", "sender"]} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Дата поступления" name={["structured_data", "received_at"]} rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Тема" name={["structured_data", "subject"]} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Текст" name={["structured_data", "body_text"]} rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Создать резолюцию"
        open={Boolean(resolutionFor)}
        onCancel={() => setResolutionFor(null)}
        onOk={() => resolutionForm.submit()}
      >
        <Form
          form={resolutionForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!resolutionFor) {
              return;
            }
            await resolutionMutation.mutateAsync({
              incomingId: resolutionFor.id,
              payload: {
                ...values,
                structured_data: {
                  ...values.structured_data,
                  linked_incoming_letter_id: resolutionFor.id,
                  assignee_statuses: values.structured_data.assignee_statuses ?? {},
                },
              },
            });
          }}
        >
          <Form.Item label="Название" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Дата" name="document_date">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Отдел" name="department_id">
            <Select allowClear options={departmentOptions} />
          </Form.Item>
          <Form.Item label="Организация" name="organization_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Должность подписанта" name="signer_position" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="ФИО подписанта" name="signer_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Текст резолюции" name={["structured_data", "resolution_text"]} rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Исполнители" name={["structured_data", "assigned_users"]}>
            <Select mode="multiple" options={userOptions} />
          </Form.Item>
          <Form.Item label="Отделы" name={["structured_data", "assigned_departments"]}>
            <Select mode="multiple" options={departmentOptions} />
          </Form.Item>
          <Form.Item initialValue={{}} name={["structured_data", "assignee_statuses"]} hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
