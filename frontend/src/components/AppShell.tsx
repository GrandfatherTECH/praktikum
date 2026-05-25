import { LogoutOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Layout, Menu, Modal, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useChangePasswordMutation, useLogoutMutation } from "../app/auth";
import { ROLE_LABELS } from "../constants/roles";
import type { User } from "../api/types";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

type AppShellProps = {
  currentUser: User;
};

const menuItems = [
  { key: "/", label: "Главная" },
  { key: "/documents", label: "Документы" },
  { key: "/documents/new", label: "Новые" },
  { key: "/documents/current", label: "Текущие" },
  { key: "/documents/mine", label: "Созданные мной" },
  { key: "/archive", label: "Архив" },
  { key: "/incoming", label: "Входящая документация" },
  { key: "/resolutions", label: "Резолюции" },
  { key: "/users", label: "Пользователи" },
  { key: "/departments", label: "Отделы" },
  { key: "/audit", label: "Журнал действий" },
];

export function AppShell({ currentUser }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const logoutMutation = useLogoutMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const [forcePasswordModalOpen, setForcePasswordModalOpen] = useState(currentUser.must_change_password);
  const [passwordForm] = Form.useForm<{ current_password: string; new_password: string; confirm_password: string }>();
  const { notification } = App.useApp();

  useEffect(() => {
    setForcePasswordModalOpen(currentUser.must_change_password);
  }, [currentUser.must_change_password]);

  const selectedKey = useMemo(() => {
    const pathname = location.pathname;
    const exact = menuItems.find((item) => item.key === pathname);
    if (exact) {
      return exact.key;
    }

    const matched = [...menuItems]
      .sort((left, right) => right.key.length - left.key.length)
      .find((item) => item.key !== "/" && pathname.startsWith(item.key));

    return matched?.key ?? "/";
  }, [location.pathname]);

  return (
    <Layout className="app-layout">
      <Sider width={260} theme="light" breakpoint="lg" collapsedWidth={0}>
        <div className="app-logo">
          <Title level={4}>СЭД</Title>
          <Text type="secondary">Локальная система</Text>
        </div>
        <Menu
          className="app-menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            void navigate(key);
          }}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div className="app-header-bar">
            <div className="app-header-copy">
              <Text className="app-header-kicker">Система электронного документооборота</Text>
            </div>
            <Space size="middle" align="center" className="app-header-actions">
              <div className="app-user-meta">
                <Text strong className="app-user-name">
                  {currentUser.full_name}
                </Text>
                <Text type="secondary" className="app-user-role">
                  {ROLE_LABELS[currentUser.role]}
                </Text>
              </div>
              <Button
                icon={<LogoutOutlined />}
                loading={logoutMutation.isPending}
                onClick={async () => {
                  await logoutMutation.mutateAsync();
                  await navigate("/login", { replace: true });
                }}
              >
                Выход
              </Button>
            </Space>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
      <Modal
        title="Требуется смена пароля"
        open={forcePasswordModalOpen}
        closable={false}
        maskClosable={false}
        keyboard={false}
        onOk={() => passwordForm.submit()}
        okText="Сменить пароль"
        cancelButtonProps={{ style: { display: "none" } }}
        confirmLoading={changePasswordMutation.isPending}
      >
        <Typography.Paragraph type="secondary">
          Администратор выдал временный пароль. Для продолжения работы задайте новый постоянный пароль.
        </Typography.Paragraph>
        <Form
          form={passwordForm}
          layout="vertical"
          autoComplete="off"
          onFinish={async (values) => {
            await changePasswordMutation.mutateAsync({
              current_password: values.current_password,
              new_password: values.new_password,
            });
            setForcePasswordModalOpen(false);
            passwordForm.resetFields();
            notification.info({
              message: "Требуется повторный вход",
              description: "Текущая сессия завершена после смены пароля.",
            });
            await navigate("/login", { replace: true });
          }}
        >
          <Form.Item
            label="Текущий временный пароль"
            name="current_password"
            rules={[{ required: true, message: "Введите текущий временный пароль" }]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Новый пароль"
            name="new_password"
            rules={[
              { required: true, message: "Введите новый пароль" },
              { min: 8, message: "Минимальная длина пароля 8 символов" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Подтверждение пароля"
            name="confirm_password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "Подтвердите новый пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Пароли не совпадают"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
