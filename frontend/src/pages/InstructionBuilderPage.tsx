import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Space, Typography } from "antd";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { createInstruction, generateInstruction, sendInstruction, updateInstruction } from "../api/documents";
import { MarkdownEditor } from "../components/MarkdownEditor";
import type { InstructionPayload } from "../api/types";
import { QueryState } from "../components/QueryState";
import { getErrorMessage } from "../utils/errors";
import { useDocumentDetailQuery } from "./hooks";

type InstructionFormValues = Omit<InstructionPayload, "structured_data"> & {
  structured_data: {
    instruction_subject: string;
    purpose_text: string;
    instruction_items: { value: string }[];
    control_assignee_text: string;
  };
};

export function InstructionBuilderPage() {
  const { documentId } = useParams();
  const isEdit = Boolean(documentId);
  const [form] = Form.useForm<InstructionFormValues>();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const documentQuery = useDocumentDetailQuery(Number(documentId), isEdit);

  const saveMutation = useMutation({
    mutationFn: async (values: InstructionPayload) => {
      if (isEdit) {
        return updateInstruction(Number(documentId), values);
      }
      return createInstruction(values);
    },
  });
  const generateMutation = useMutation({ mutationFn: generateInstruction });
  const sendMutation = useMutation({
    mutationFn: (docId: number) => sendInstruction(docId),
  });

  useEffect(() => {
    if (documentQuery.data) {
      const data = documentQuery.data.structured_data as Record<string, unknown>;
      form.setFieldsValue({
        title: documentQuery.data.title,
        registered_number: documentQuery.data.registered_number ?? undefined,
        document_date: documentQuery.data.document_date ?? undefined,
        city: documentQuery.data.city,
        organization_name: documentQuery.data.organization_name,
        signer_position: documentQuery.data.signer_position,
        signer_name: documentQuery.data.signer_name,
        executor_name: documentQuery.data.executor_name ?? undefined,
        executor_phone: documentQuery.data.executor_phone ?? undefined,
        structured_data: {
          instruction_subject: String(data.instruction_subject ?? ""),
          purpose_text: String(data.purpose_text ?? ""),
          instruction_items: Array.isArray(data.instruction_items)
            ? (data.instruction_items as string[]).map((value) => ({ value }))
            : [{ value: "" }],
          control_assignee_text: String(data.control_assignee_text ?? ""),
        },
      });
    } else if (!isEdit) {
      form.setFieldsValue({
        structured_data: {
          instruction_items: [{ value: "" }],
          instruction_subject: "",
          purpose_text: "",
          control_assignee_text: "",
        } as never,
      });
    }
  }, [documentQuery.data, form, isEdit]);

  const normalize = (values: InstructionFormValues): InstructionPayload => ({
    ...values,
    department_id: values.department_id ?? null,
    registered_number: values.registered_number ?? null,
    document_date: values.document_date ?? null,
    executor_name: values.executor_name ?? null,
    executor_phone: values.executor_phone ?? null,
    structured_data: {
      ...values.structured_data,
      instruction_items: values.structured_data.instruction_items.map((item) => item.value),
    },
  });

  const saveAndThen = async (mode: "save" | "generate" | "send") => {
    const values = normalize(await form.validateFields());
    const document = await saveMutation.mutateAsync(values);
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    if (mode === "generate") {
      await generateMutation.mutateAsync(document.id);
    }
    if (mode === "send") {
      await sendMutation.mutateAsync(document.id);
    }
    notification.success({ message: "Операция выполнена" });
    await navigate(`/documents/${document.id}`);
  };

  if (isEdit) {
    return (
      <QueryState
        isLoading={documentQuery.isLoading}
        error={documentQuery.error ? getErrorMessage(documentQuery.error) : undefined}
      >
        {documentQuery.data ? (
          <InstructionBuilderInner
            title="Редактирование приказания"
            form={form}
            onSaveAndThen={saveAndThen}
            loading={saveMutation.isPending || generateMutation.isPending || sendMutation.isPending}
          />
        ) : null}
      </QueryState>
    );
  }

  return (
    <InstructionBuilderInner
      title="Создание приказания"
      form={form}
      onSaveAndThen={saveAndThen}
      loading={saveMutation.isPending || generateMutation.isPending || sendMutation.isPending}
    />
  );
}

type InstructionBuilderInnerProps = {
  title: string;
  form: ReturnType<typeof Form.useForm<InstructionFormValues>>[0];
  onSaveAndThen: (mode: "save" | "generate" | "send") => Promise<void>;
  loading: boolean;
};

function InstructionBuilderInner({
  title,
  form,
  onSaveAndThen,
  loading,
}: InstructionBuilderInnerProps) {
  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3}>{title}</Typography.Title>
      </Card>
      <Card>
        <Form form={form} layout="vertical">
          <Form.Item label="Название" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space.Compact block>
            <Form.Item label="Дата документа" name="document_date" style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item label="Номер" name="registered_number" style={{ flex: 1 }}>
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
          <Form.Item label="Тема" name={["structured_data", "instruction_subject"]} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Цель" name={["structured_data", "purpose_text"]} rules={[{ required: true }]}>
            <MarkdownEditor rows={8} placeholder="Опишите цель приказания с форматированием Markdown." />
          </Form.Item>
          <Form.List name={["structured_data", "instruction_items"]}>
            {(fields, { add, remove }) => (
              <Card size="small" title="Пункты приказания" extra={<Button onClick={() => add({ value: "" })}>Добавить пункт</Button>}>
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="start">
                      <Typography.Text>{index + 1}.</Typography.Text>
                      <Form.Item {...field} name={[field.name, "value"]} rules={[{ required: true }]} style={{ minWidth: 600 }}>
                        <MarkdownEditor rows={7} placeholder="Текст пункта приказания в Markdown." />
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
          Отправить
        </Button>
      </Space>
    </Space>
  );
}
