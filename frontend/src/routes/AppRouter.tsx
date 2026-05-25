import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { QueryState } from "../components/QueryState";
import { useCurrentUserQuery } from "../app/auth";
import { DashboardPage } from "../pages/DashboardPage";
import { DepartmentsPage } from "../pages/DepartmentsPage";
import { LoginPage } from "../pages/LoginPage";
import { PagePlaceholder } from "../components/PagePlaceholder";
import { UsersPage } from "../pages/UsersPage";

function RequireAuth() {
  const currentUserQuery = useCurrentUserQuery();

  if (currentUserQuery.isLoading) {
    return <QueryState isLoading={true}>{null}</QueryState>;
  }

  if (currentUserQuery.error) {
    const status = "status" in currentUserQuery.error ? currentUserQuery.error.status : undefined;
    if (status === 401) {
      return <Navigate to="/login" replace />;
    }
    return <QueryState isLoading={false} error="Не удалось загрузить данные текущего пользователя.">{null}</QueryState>;
  }

  if (!currentUserQuery.data) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell currentUser={currentUserQuery.data} />;
}

function PublicOnly() {
  const currentUserQuery = useCurrentUserQuery();

  if (currentUserQuery.isLoading) {
    return <QueryState isLoading={true}>{null}</QueryState>;
  }

  if (currentUserQuery.data) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly />} />
        <Route path="/" element={<RequireAuth />}>
          <Route index element={<DashboardPage />} />
          <Route path="documents" element={<PagePlaceholder title="Документы" />} />
          <Route path="documents/new" element={<PagePlaceholder title="Новые" />} />
          <Route path="documents/current" element={<PagePlaceholder title="Текущие" />} />
          <Route path="documents/mine" element={<PagePlaceholder title="Созданные мной" />} />
          <Route path="archive" element={<PagePlaceholder title="Архив" />} />
          <Route path="incoming" element={<PagePlaceholder title="Входящая документация" />} />
          <Route path="resolutions" element={<PagePlaceholder title="Резолюции" />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="audit" element={<PagePlaceholder title="Журнал действий" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
