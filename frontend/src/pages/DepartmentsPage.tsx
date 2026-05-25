import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { createDepartment, deleteDepartment, updateDepartment } from "../api/departments";
import type { Department, DepartmentCreatePayload, DepartmentUpdatePayload } from "../api/types";
import { useCurrentUserQuery } from "../app/auth";
import { QueryState } from "../components/QueryState";
import { applyValidationErrors, getErrorMessage } from "../utils/errors";
import { useDepartmentsQuery, useUsersQuery } from "./hooks";

type DepartmentFormValues = {
  name: string;
  head_user_id?: number;
  is_active: boolean;
};

export function DepartmentsPage() {
  const currentUserQuery = useCurrentUserQuery();
  const departmentsQuery = useDepartmentsQuery();
  const canManageDepartments = currentUserQuery.data?.role === "ADMIN";
  const usersQuery = useUsersQuery(canManageDepartments);
  const queryClient = useQueryClient();
  const { notification } = App.useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [createForm] = Form.useForm<DepartmentFormValues>();
  const [editForm] = Form.useForm<DepartmentFormValues>();

  const userOptions = useMemo(
    () =>
      (usersQuery.data ?? []).map((user) => ({
        label: user.full_name,
        value: user.id,
      })),
    [usersQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({
        message: "Отдел создан",
        description: "Новый отдел успешно добавлен.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ departmentId, payload }: { departmentId: number; payload: DepartmentUpdatePayload }) =>
      updateDepartment(departmentId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({
        message: "Отдел обновлен",
        description: "Изменения сохранены.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({
        message: "Отдел удален",
        description: "Запись об отделе удалена.",
      });
    },
  });

  const columns: ColumnsType<Department> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Руководитель",
      key: "head_user_id",
      render: (_, record) => usersQuery.data?.find((user) => user.id === record.head_user_id)?.full_name ?? "Не назначен",
    },
    {
      title: "Активен",
      key: "is_active",
      render: (_, record) => <Tag color={record.is_active ? "green" : "default"}>{record.is_active ? "Да" : "Нет"}</Tag>,
    },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) =>
        canManageDepartments ? (
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingDepartment(record);
                editForm.setFieldsValue({
                  name: record.name,
                  head_user_id: record.head_user_id ?? undefined,
                  is_active: record.is_active,
                });
              }}
            >
              Изменить
            </Button>
            {currentUserQuery.data?.role === "ADMIN" ? (
              <Popconfirm
                title="Удалить отдел?"
                description="Пользователи этого отдела останутся без привязки к отделу."
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={async () => {
                  try {
                    await deleteMutation.mutateAsync(record.id);
                  } catch (error) {
                    notification.error({
                      message: "Ошибка удаления",
                      description: getErrorMessage(error, "Не удалось удалить отдел."),
                    });
                  }
                }}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                  Удалить
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Title level={3}>Отделы</Typography.Title>
            <Typography.Text type="secondary">Справочник отделов и назначение руководителей.</Typography.Text>
          </div>
          {canManageDepartments ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                createForm.setFieldsValue({ is_active: true });
                setIsCreateOpen(true);
              }}
            >
              Создать отдел
            </Button>
          ) : null}
        </Space>
      </Card>

      <Card>
        <QueryState
          isLoading={departmentsQuery.isLoading || (canManageDepartments && usersQuery.isLoading)}
          error={
            departmentsQuery.error
              ? getErrorMessage(departmentsQuery.error)
              : canManageDepartments && usersQuery.error
                ? getErrorMessage(usersQuery.error)
                : undefined
          }
          isEmpty={(departmentsQuery.data?.length ?? 0) === 0}
          emptyDescription="Отделы не найдены"
        >
          <Table rowKey="id" columns={columns} dataSource={departmentsQuery.data} pagination={{ pageSize: 10 }} />
        </QueryState>
      </Card>

      <Modal
        title="Создать отдел"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<DepartmentFormValues>
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            const payload: DepartmentCreatePayload = {
              name: values.name,
              head_user_id: values.head_user_id ?? null,
              is_active: values.is_active,
            };
            try {
              await createMutation.mutateAsync(payload);
              setIsCreateOpen(false);
              createForm.resetFields();
            } catch (error) {
              applyValidationErrors(createForm, error);
              notification.error({
                message: "Ошибка создания",
                description: getErrorMessage(error, "Не удалось создать отдел."),
              });
            }
          }}
        >
          <DepartmentFormFields userOptions={userOptions} />
        </Form>
      </Modal>

      <Modal
        title="Изменить отдел"
        open={editingDepartment !== null}
        onCancel={() => setEditingDepartment(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form<DepartmentFormValues>
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editingDepartment) {
              return;
            }

            const payload: DepartmentUpdatePayload = {
              name: values.name,
              head_user_id: values.head_user_id ?? null,
              is_active: values.is_active,
            };
            try {
              await updateMutation.mutateAsync({ departmentId: editingDepartment.id, payload });
              setEditingDepartment(null);
            } catch (error) {
              applyValidationErrors(editForm, error);
              notification.error({
                message: "Ошибка обновления",
                description: getErrorMessage(error, "Не удалось обновить отдел."),
              });
            }
          }}
        >
          <DepartmentFormFields userOptions={userOptions} />
        </Form>
      </Modal>
    </Space>
  );
}

function DepartmentFormFields({ userOptions }: { userOptions: Array<{ label: string; value: number }> }) {
  return (
    <>
      <Form.Item label="Название" name="name" rules={[{ required: true, message: "Введите название отдела" }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Руководитель" name="head_user_id">
        <Select allowClear options={userOptions} placeholder="Не назначен" />
      </Form.Item>
      <Form.Item label="Активен" name="is_active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}
