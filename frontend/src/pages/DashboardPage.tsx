import { Card, Col, Row, Space, Tag, Typography } from "antd";

import { useCurrentUserQuery } from "../app/auth";
import { ROLE_LABELS } from "../constants/roles";
import { useDepartmentsQuery } from "./hooks";

const dashboardCards = [
  { title: "Новые документы", value: "0", note: "временно" },
  { title: "На согласовании", value: "0", note: "временно" },
  { title: "На ознакомлении", value: "0", note: "временно" },
  { title: "Резолюции", value: "0", note: "временно" },
];

export function DashboardPage() {
  const currentUserQuery = useCurrentUserQuery();
  const departmentsQuery = useDepartmentsQuery();

  const currentUser = currentUserQuery.data;
  const department = departmentsQuery.data?.find((item) => item.id === currentUser?.department_id);

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3}>Главная</Typography.Title>
        <Typography.Paragraph>
          Текущий пользователь: <strong>{currentUser?.full_name}</strong>
        </Typography.Paragraph>
        <Typography.Paragraph>
          Роль: <Tag color="blue">{currentUser ? ROLE_LABELS[currentUser.role] : "Не определена"}</Tag>
        </Typography.Paragraph>
        <Typography.Paragraph>
          Отдел: <strong>{department?.name ?? "Не назначен"}</strong>
        </Typography.Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {dashboardCards.map((card) => (
          <Col xs={24} sm={12} xl={6} key={card.title}>
            <Card>
              <Typography.Text type="secondary">{card.title}</Typography.Text>
              <Typography.Title level={2} style={{ marginTop: 12, marginBottom: 0 }}>
                {card.value}
              </Typography.Title>
              <Typography.Text type="secondary">{card.note}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}
