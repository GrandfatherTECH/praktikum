import { CheckOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { approveUser, createUser, updateUser } from "../api/users";
import { ApiError } from "../api/client";
import type { Department, User, UserCreatePayload, UserRole, UserUpdatePayload } from "../api/types";
import { useCurrentUserQuery } from "../app/auth";
import { QueryState } from "../components/QueryState";
import { ADMIN_ROLES, ROLE_LABELS } from "../constants/roles";
import { applyValidationErrors, getErrorMessage } from "../utils/errors";
import { useDepartmentsQuery, useUsersQuery } from "./hooks";

type UserFormValues = {
  full_name: string;
  username?: string;
  password?: string;
  role: UserRole;
  department_id?: number;
  position?: string;
  is_active: boolean;
};

function findDepartmentName(departments: Department[], departmentId: number | null) {
  return departments.find((item) => item.id === departmentId)?.name ?? "Не назначен";
}

export function UsersPage() {
  const currentUserQuery = useCurrentUserQuery();
  const usersQuery = useUsersQuery(ADMIN_ROLES.includes(currentUserQuery.data?.role ?? "EMPLOYEE"));
  const departmentsQuery = useDepartmentsQuery();
  const queryClient = useQueryClient();
  const { notification } = App.useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm] = Form.useForm<UserFormValues>();
  const [editForm] = Form.useForm<UserFormValues>();

  const canManageUsers = ADMIN_ROLES.includes(currentUserQuery.data?.role ?? "EMPLOYEE");

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        label: department.name,
        value: department.id,
      })),
    [departmentsQuery.data],
  );

  const commonSuccess = async (message: string, description: string) => {
    await queryClient.invalidateQueries({ queryKey: ["users"] });
    notification.success({ message, description });
  };

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => commonSuccess("Пользователь создан", "Новая учетная запись добавлена."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UserUpdatePayload }) => updateUser(userId, payload),
    onSuccess: async () => commonSuccess("Пользователь обновлен", "Изменения сохранены."),
  });

  const approveMutation = useMutation({
    mutationFn: approveUser,
    onSuccess: async () => commonSuccess("Пользователь подтвержден", "Доступ к системе разрешен."),
  });

  const columns: ColumnsType<User> = [
    {
      title: "ФИО",
      dataIndex: "full_name",
      key: "full_name",
    },
    {
      title: "Логин",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Роль",
      key: "role",
      render: (_, record) => ROLE_LABELS[record.role],
    },
    {
      title: "Отдел",
      key: "department",
      render: (_, record) => findDepartmentName(departmentsQuery.data ?? [], record.department_id),
    },
    {
      title: "Активен",
      key: "is_active",
      render: (_, record) => <Tag color={record.is_active ? "green" : "default"}>{record.is_active ? "Да" : "Нет"}</Tag>,
    },
    {
      title: "Подтвержден",
      key: "is_approved",
      render: (_, record) => (
        <Tag color={record.is_approved ? "blue" : "orange"}>{record.is_approved ? "Да" : "Нет"}</Tag>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingUser(record);
              editForm.setFieldsValue({
                full_name: record.full_name,
                role: record.role,
                department_id: record.department_id ?? undefined,
                position: record.position ?? undefined,
                is_active: record.is_active,
              });
            }}
          >
            Изменить
          </Button>
          {!record.is_approved ? (
            <Button
              type="primary"
              ghost
              icon={<CheckOutlined />}
              loading={approveMutation.isPending}
              onClick={async () => {
                try {
                  await approveMutation.mutateAsync(record.id);
                } catch (error) {
                  notification.error({
                    message: "Ошибка подтверждения",
                    description: getErrorMessage(error, "Не удалось подтвердить пользователя."),
                  });
                }
              }}
            >
              Подтвердить
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (!canManageUsers) {
    return <QueryState isLoading={false} forbidden={true}>unused</QueryState>;
  }

  const usersForbidden = usersQuery.error instanceof ApiError && usersQuery.error.status === 403;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Title level={3}>Пользователи</Typography.Title>
            <Typography.Text type="secondary">Управление учетными записями и подтверждением доступа.</Typography.Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              createForm.setFieldsValue({ is_active: true, role: "EMPLOYEE" });
              setIsCreateOpen(true);
            }}
          >
            Создать пользователя
          </Button>
        </Space>
      </Card>

      <Card>
        <QueryState
          isLoading={usersQuery.isLoading || departmentsQuery.isLoading}
          forbidden={usersForbidden}
          error={usersQuery.error ? getErrorMessage(usersQuery.error) : departmentsQuery.error ? getErrorMessage(departmentsQuery.error) : undefined}
          isEmpty={(usersQuery.data?.length ?? 0) === 0}
          emptyDescription="Пользователи не найдены"
        >
          <Table rowKey="id" columns={columns} dataSource={usersQuery.data} pagination={{ pageSize: 10 }} />
        </QueryState>
      </Card>

      <Modal
        title="Создать пользователя"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<UserFormValues>
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            const payload: UserCreatePayload = {
              full_name: values.full_name,
              username: values.username ?? "",
              password: values.password ?? "",
              role: values.role,
              department_id: values.department_id ?? null,
              position: values.position ?? null,
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
                description: getErrorMessage(error, "Не удалось создать пользователя."),
              });
            }
          }}
        >
          <UserFormFields departmentOptions={departmentOptions} requireCredentials={true} />
        </Form>
      </Modal>

      <Modal
        title="Изменить пользователя"
        open={editingUser !== null}
        onCancel={() => setEditingUser(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form<UserFormValues>
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editingUser) {
              return;
            }

            const payload: UserUpdatePayload = {
              full_name: values.full_name,
              role: values.role,
              department_id: values.department_id ?? null,
              position: values.position ?? null,
              is_active: values.is_active,
            };

            try {
              await updateMutation.mutateAsync({ userId: editingUser.id, payload });
              setEditingUser(null);
            } catch (error) {
              applyValidationErrors(editForm, error);
              notification.error({
                message: "Ошибка обновления",
                description: getErrorMessage(error, "Не удалось обновить пользователя."),
              });
            }
          }}
        >
          <UserFormFields departmentOptions={departmentOptions} requireCredentials={false} />
        </Form>
      </Modal>
    </Space>
  );
}

function UserFormFields({
  departmentOptions,
  requireCredentials,
}: {
  departmentOptions: Array<{ label: string; value: number }>;
  requireCredentials: boolean;
}) {
  return (
    <>
      <Form.Item label="ФИО" name="full_name" rules={[{ required: true, message: "Введите ФИО" }]}>
        <Input />
      </Form.Item>
      {requireCredentials ? (
        <>
          <Form.Item label="Логин" name="username" rules={[{ required: true, message: "Введите логин" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: "Введите пароль" },
              { min: 8, message: "Минимальная длина пароля 8 символов" },
            ]}
          >
            <Input.Password />
          </Form.Item>
        </>
      ) : null}
      <Form.Item label="Роль" name="role" rules={[{ required: true, message: "Выберите роль" }]}>
        <Select options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
      </Form.Item>
      <Form.Item label="Отдел" name="department_id">
        <Select allowClear options={departmentOptions} placeholder="Не назначен" />
      </Form.Item>
      <Form.Item label="Должность" name="position">
        <Input />
      </Form.Item>
      <Form.Item label="Активен" name="is_active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}
