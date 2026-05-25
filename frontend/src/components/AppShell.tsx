import { LogoutOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Space, Typography } from "antd";
import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useLogoutMutation } from "../app/auth";
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
    </Layout>
  );
}
