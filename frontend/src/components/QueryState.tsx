import { Alert, Card, Spin, Typography } from "antd";
import type { ReactNode } from "react";

type QueryStateProps = {
  isLoading: boolean;
  error?: ReactNode;
  isEmpty?: boolean;
  emptyDescription?: ReactNode;
  forbidden?: boolean;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  error,
  isEmpty = false,
  emptyDescription,
  forbidden = false,
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="centered-state">
        <Spin size="large" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <Card className="state-card">
        <Typography.Title level={4}>Доступ ограничен</Typography.Title>
        <Typography.Text type="secondary">Недостаточно прав для просмотра раздела.</Typography.Text>
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  if (isEmpty) {
    return (
      <Card className="state-card">
        <Typography.Title level={5}>Нет данных</Typography.Title>
        <Typography.Text type="secondary">{emptyDescription ?? "Данные отсутствуют"}</Typography.Text>
      </Card>
    );
  }

  return <>{children}</>;
}
