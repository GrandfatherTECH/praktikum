import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Select, Space, Typography } from "antd";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { createOrder, generateOrder, sendOrderForApproval, updateOrder } from "../api/documents";
import { MarkdownEditor } from "../components/MarkdownEditor";
import type { OrderPayload } from "../api/types";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { useDocumentDetailQuery, useDepartmentsQuery, useUsersQuery } from "./hooks";

type OrderFormValues = Omit<OrderPayload, "structured_data"> & {
  structured_data: {
    order_subject: string;
    legal_basis_text: string;
    purpose_text: string;
    order_items: { value: string }[];
    control_assignee_text: string;
    approval_people: number[];
    acknowledgement_people: number[];
    acknowledgement_departments: number[];
  };
};

export function OrderBuilderPage() {
  const { documentId } = useParams();
  const isEdit = Boolean(documentId);
  const [form] = Form.useForm<OrderFormValues>();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const documentQuery = useDocumentDetailQuery(Number(documentId), isEdit);

  const userOptions = useMemo(
    () => (usersQuery.data ?? []).map((user) => ({ label: user.full_name, value: user.id })),
    [usersQuery.data],
  );
  const departmentOptions = useMemo(
    () => (departmentsQuery.data ?? []).map((department) => ({ label: department.name, value: department.id })),
    [departmentsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: OrderPayload) => {
      if (isEdit) {
        return updateOrder(Number(documentId), values);
      }
      return createOrder(values);
    },
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["document", document.id] });
      notification.success({ message: "Приказ сохранен" });
      await navigate(`/documents/${document.id}`);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (documentIdValue: number) => generateOrder(documentIdValue),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["document", response.document.id] });
      notification.success({ message: "Предпросмотр сформирован" });
      await navigate(`/documents/${response.document.id}`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ docId, approverIds }: { docId: number; approverIds: number[] }) =>
      sendOrderForApproval(docId, { approver_ids: approverIds }),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["document", document.id] });
      notification.success({ message: "Приказ отправлен на согласование" });
      await navigate(`/documents/${document.id}`);
    },
  });

  useEffect(() => {
    if (documentQuery.data) {
      const data = documentQuery.data.structured_data as Record<string, unknown>;
      form.setFieldsValue({
        title: documentQuery.data.title,
        registered_number: documentQuery.data.registered_number ?? undefined,
        registered_date: documentQuery.data.registered_date ?? undefined,
        document_date: documentQuery.data.document_date ?? undefined,
        city: documentQuery.data.city,
        organization_name: documentQuery.data.organization_name,
        signer_position: documentQuery.data.signer_position,
        signer_name: documentQuery.data.signer_name,
        executor_name: documentQuery.data.executor_name ?? undefined,
        executor_phone: documentQuery.data.executor_phone ?? undefined,
        structured_data: {
          order_subject: String(data.order_subject ?? ""),
          legal_basis_text: String(data.legal_basis_text ?? ""),
          purpose_text: String(data.purpose_text ?? ""),
          order_items: Array.isArray(data.order_items)
            ? (data.order_items as string[]).map((value) => ({ value }))
            : [{ value: "" }],
          control_assignee_text: String(data.control_assignee_text ?? ""),
          approval_people: Array.isArray(data.approval_people) ? (data.approval_people as number[]) : [],
          acknowledgement_people: Array.isArray(data.acknowledgement_people) ? (data.acknowledgement_people as number[]) : [],
          acknowledgement_departments: Array.isArray(data.acknowledgement_departments)
            ? (data.acknowledgement_departments as number[])
            : [],
        },
      });
    } else if (!isEdit) {
      form.setFieldsValue({
        structured_data: {
          order_items: [{ value: "" }],
          order_subject: "",
          legal_basis_text: "",
          purpose_text: "",
          control_assignee_text: "",
          approval_people: [],
          acknowledgement_people: [],
          acknowledgement_departments: [],
        },
      });
    }
  }, [documentQuery.data, form, isEdit]);

  const normalizePayload = (values: OrderFormValues): OrderPayload => ({
    ...values,
    department_id: values.department_id ?? null,
    registered_number: values.registered_number ?? null,
    registered_date: values.registered_date ?? null,
    document_date: values.document_date ?? null,
    executor_name: values.executor_name ?? null,
    executor_phone: values.executor_phone ?? null,
    structured_data: {
      ...values.structured_data,
      order_items: values.structured_data.order_items.map((item) => item.value),
    },
  });

  const saveAndThen = async (mode: "save" | "generate" | "send") => {
    const values = await form.validateFields();
    const payload = normalizePayload(values);
    const document = await saveMutation.mutateAsync(payload);
    if (mode === "generate") {
      await generateMutation.mutateAsync(document.id);
    }
    if (mode === "send") {
      await sendMutation.mutateAsync({ docId: document.id, approverIds: payload.structured_data.approval_people });
    }
  };

  if (isEdit) {
    return (
      <QueryState
        isLoading={documentQuery.isLoading || usersQuery.isLoading || departmentsQuery.isLoading}
        error={documentQuery.error ? getErrorMessage(documentQuery.error) : undefined}
      >
        {documentQuery.data ? (
          <OrderBuilderInner
            title="Редактирование приказа"
            form={form}
            departmentOptions={departmentOptions}
            userOptions={userOptions}
            onSaveAndThen={saveAndThen}
            loading={saveMutation.isPending || generateMutation.isPending || sendMutation.isPending}
          />
        ) : null}
      </QueryState>
    );
  }

  return (
    <OrderBuilderInner
      title="Создание приказа"
      form={form}
      departmentOptions={departmentOptions}
      userOptions={userOptions}
      onSaveAndThen={saveAndThen}
      loading={saveMutation.isPending || generateMutation.isPending || sendMutation.isPending}
    />
  );
}

type BuilderInnerProps = {
  title: string;
  form: ReturnType<typeof Form.useForm<OrderFormValues>>[0];
  departmentOptions: { label: string; value: number }[];
  userOptions: { label: string; value: number }[];
  onSaveAndThen: (mode: "save" | "generate" | "send") => Promise<void>;
  loading: boolean;
};

function OrderBuilderInner({ title, form, departmentOptions, userOptions, onSaveAndThen, loading }: BuilderInnerProps) {
  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Text type="secondary">Структурированный конструктор приказа с серверной генерацией DOCX и PDF.</Typography.Text>
      </Card>
      <Card>
        <Form form={form} layout="vertical">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Form.Item label="Название" name="title" rules={[{ required: true, message: "Укажите название" }]}>
              <Input />
            </Form.Item>
            <Space.Compact block>
              <Form.Item label="Дата документа" name="document_date" style={{ flex: 1 }}>
                <Input type="date" />
              </Form.Item>
              <Form.Item label="Регистрационный номер" name="registered_number" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Space.Compact block>
              <Form.Item label="Должность подписанта" name="signer_position" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="ФИО подписанта" name="signer_name" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item label="Тема приказа" name={["structured_data", "order_subject"]} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Правовое основание" name={["structured_data", "legal_basis_text"]} rules={[{ required: true }]}>
              <MarkdownEditor rows={8} placeholder="Например: **В целях** организации работы." />
            </Form.Item>
            <Form.Item label="Цель" name={["structured_data", "purpose_text"]} rules={[{ required: true }]}>
              <MarkdownEditor rows={8} placeholder="Опишите цель приказа с нужным форматированием." />
            </Form.Item>
            <Form.List name={["structured_data", "order_items"]}>
              {(fields, { add, remove }) => (
                <Card size="small" title="Пункты приказа" extra={<Button onClick={() => add({ value: "" })}>Добавить пункт</Button>}>
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {fields.map((field, index) => (
                      <Space key={field.key} align="start" style={{ display: "flex" }}>
                        <Typography.Text>{index + 1}.</Typography.Text>
                        <Form.Item {...field} name={[field.name, "value"]} rules={[{ required: true }]} style={{ minWidth: 600 }}>
                          <MarkdownEditor rows={7} placeholder="Текст пункта приказа в Markdown." />
                        </Form.Item>
                        <Button danger onClick={() => remove(field.name)}>
                          Удалить
                        </Button>
                      </Space>
                    ))}
                  </Space>
                </Card>
              )}
            </Form.List>
            <Form.Item label="Контроль исполнения" name={["structured_data", "control_assignee_text"]} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Согласующие по порядку" name={["structured_data", "approval_people"]} rules={[{ required: true }]}>
              <Select mode="multiple" options={userOptions} optionFilterProp="label" />
            </Form.Item>
            <Form.Item label="Пользователи для ознакомления" name={["structured_data", "acknowledgement_people"]}>
              <Select mode="multiple" options={userOptions} optionFilterProp="label" />
            </Form.Item>
            <Form.Item label="Отделы для ознакомления" name={["structured_data", "acknowledgement_departments"]}>
              <Select mode="multiple" options={departmentOptions} optionFilterProp="label" />
            </Form.Item>
            <Space.Compact block>
              <Form.Item label="Исполнитель" name="executor_name" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
              <Form.Item label="Телефон исполнителя" name="executor_phone" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
          </Space>
        </Form>
      </Card>
      <Space>
        <Button type="primary" loading={loading} onClick={() => void onSaveAndThen("save")}>
          Сохранить черновик
        </Button>
        <Button loading={loading} onClick={() => void onSaveAndThen("generate")}>
          Сформировать предпросмотр
        </Button>
        <Button loading={loading} onClick={() => void onSaveAndThen("send")}>
          Отправить на согласование
        </Button>
      </Space>
    </Space>
  );
}
