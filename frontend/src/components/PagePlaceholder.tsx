import { Card, Typography } from "antd";

type PagePlaceholderProps = {
  title: string;
};

export function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <Card>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Typography.Paragraph>Раздел будет реализован на следующем этапе.</Typography.Paragraph>
    </Card>
  );
}
