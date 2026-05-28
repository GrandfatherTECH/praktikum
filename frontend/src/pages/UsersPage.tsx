import { CheckOutlined, EditOutlined, KeyOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
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

import { approveUser, createOneTimePassword, createUser, deleteUser, updateUser } from "../api/users";
import { ApiError } from "../api/client";
import type { Department, User, UserCreatePayload, UserRole, UserUpdatePayload } from "../api/types";
import { useCurrentUserQuery } from "../app/auth";
import { QueryState } from "../components/QueryState";
import { CHIEF_MANAGED_ROLES, ROLE_LABELS } from "../constants/roles";
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
  const usersQuery = useUsersQuery();
  const departmentsQuery = useDepartmentsQuery();
  const queryClient = useQueryClient();
  const { notification } = App.useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [otpModal, setOtpModal] = useState<{ user: User; password: string } | null>(null);
  const [createForm] = Form.useForm<UserFormValues>();
  const [editForm] = Form.useForm<UserFormValues>();

  const currentRole = currentUserQuery.data?.role ?? "EMPLOYEE";
  const canApproveUsers = currentRole === "CHIEF";
  const canCreateUsers = currentRole === "ADMIN" || currentRole === "CHIEF";
  const canManageUsers = currentRole === "ADMIN" || currentRole === "CHIEF";
  const canAdminUsers = currentRole === "ADMIN";

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

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => commonSuccess("Пользователь удален", "Учетная запись удалена."),
  });

  const otpMutation = useMutation({
    mutationFn: createOneTimePassword,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setOtpModal({ user: response.user, password: response.temporary_password });
      notification.success({
        message: "Одноразовый пароль создан",
        description: "Передайте временный пароль пользователю безопасным каналом.",
      });
    },
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
          {canManageUsers ? (
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
          ) : null}
          {canApproveUsers && !record.is_approved ? (
            <Button
              type="primary"
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
          {canAdminUsers ? (
            <Button
              icon={<KeyOutlined />}
              loading={otpMutation.isPending}
              onClick={async () => {
                try {
                  await otpMutation.mutateAsync(record.id);
                } catch (error) {
                  notification.error({
                    message: "Ошибка создания временного пароля",
                    description: getErrorMessage(error, "Не удалось создать временный пароль."),
                  });
                }
              }}
            >
              Одноразовый пароль
            </Button>
          ) : null}
          {canAdminUsers ? (
            <Popconfirm
              title="Удалить пользователя?"
              description="Действие необратимо. Все активные сессии пользователя будут прекращены."
              okText="Удалить"
              cancelText="Отмена"
              onConfirm={async () => {
                try {
                  await deleteMutation.mutateAsync(record.id);
                } catch (error) {
                  notification.error({
                    message: "Ошибка удаления",
                    description: getErrorMessage(error, "Не удалось удалить пользователя."),
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
      ),
    },
  ];

  const usersForbidden = usersQuery.error instanceof ApiError && usersQuery.error.status === 403;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Title level={3}>Пользователи</Typography.Title>
            <Typography.Text type="secondary">Управление учетными записями и подтверждением доступа.</Typography.Text>
          </div>
          {canCreateUsers ? (
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
          ) : null}
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
          <UserFormFields currentRole={currentRole} departmentOptions={departmentOptions} requireCredentials={true} />
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
          <UserFormFields currentRole={currentRole} departmentOptions={departmentOptions} requireCredentials={false} />
        </Form>
      </Modal>

      <Modal
        title="Одноразовый пароль"
        open={otpModal !== null}
        footer={
          <Button
            type="primary"
            onClick={() => {
              setOtpModal(null);
            }}
          >
            Закрыть
          </Button>
        }
        onCancel={() => setOtpModal(null)}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Показывается только один раз"
            description="После закрытия окна временный пароль больше не будет доступен в интерфейсе."
          />
          <Typography.Text>
            Пользователь: <strong>{otpModal?.user.full_name}</strong>
          </Typography.Text>
          <Card size="small">
            <Typography.Text code copyable={{ text: otpModal?.password ?? "" }}>
              {otpModal?.password}
            </Typography.Text>
          </Card>
          <Typography.Text type="secondary">
            После входа с этим паролем пользователь будет обязан задать новый пароль.
          </Typography.Text>
        </Space>
      </Modal>
    </Space>
  );
}

function UserFormFields({
  currentRole,
  departmentOptions,
  requireCredentials,
}: {
  currentRole: User["role"];
  departmentOptions: Array<{ label: string; value: number }>;
  requireCredentials: boolean;
}) {
  const roleOptions = (currentRole === "ADMIN"
    ? Object.entries(ROLE_LABELS)
    : Object.entries(ROLE_LABELS).filter(([value]) => CHIEF_MANAGED_ROLES.includes(value as User["role"]))).map(
    ([value, label]) => ({ value, label }),
  );

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
        <Select options={roleOptions} />
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
