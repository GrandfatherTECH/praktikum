import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { useLoginMutation } from "../app/auth";
import type { LoginPayload } from "../api/types";
import { applyValidationErrors, getErrorMessage } from "../utils/errors";

export function LoginPage() {
  const [form] = Form.useForm<LoginPayload>();
  const loginMutation = useLoginMutation();
  const navigate = useNavigate();
  const { notification } = App.useApp();

  const errorMessage = loginMutation.isError ? getErrorMessage(loginMutation.error, "Не удалось выполнить вход.") : null;

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Text className="login-kicker">Защищенная передача документов</Typography.Text>
        <Typography.Title level={2}>Вход</Typography.Title>
        <Typography.Paragraph type="secondary">
          Используйте учетную запись, выданную администратором системы.
        </Typography.Paragraph>
        {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
        <Form<LoginPayload>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await loginMutation.mutateAsync(values);
              notification.success({
                message: "Вход выполнен",
                description: "Сессия успешно создана.",
              });
              await navigate("/", { replace: true });
            } catch (error) {
              applyValidationErrors(form, error);
            }
          }}
        >
          <Form.Item label="Имя пользователя" name="username" rules={[{ required: true, message: "Введите имя пользователя" }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item label="Пароль" name="password" rules={[{ required: true, message: "Введите пароль" }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
            Вход
          </Button>
        </Form>
      </Card>
    </div>
  );
}
