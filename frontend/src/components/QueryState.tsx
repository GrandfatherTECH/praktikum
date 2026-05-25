import { Alert, Empty, Result, Spin } from "antd";
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
    return <Result status="403" title="403" subTitle="Недостаточно прав для просмотра раздела." />;
  }

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  if (isEmpty) {
    return <Empty description={emptyDescription ?? "Данные отсутствуют"} />;
  }

  return <>{children}</>;
}
