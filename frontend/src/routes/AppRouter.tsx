import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { QueryState } from "../components/QueryState";
import { useCurrentUserQuery } from "../app/auth";
import { DashboardPage } from "../pages/DashboardPage";
import { DepartmentsPage } from "../pages/DepartmentsPage";
import { DocumentDetailPage } from "../pages/DocumentDetailPage";
import { DocumentsListPage } from "../pages/DocumentsListPage";
import { IncomingPage } from "../pages/IncomingPage";
import { InstructionBuilderPage } from "../pages/InstructionBuilderPage";
import { LoginPage } from "../pages/LoginPage";
import { OrderBuilderPage } from "../pages/OrderBuilderPage";
import { AuditLogPage } from "../pages/AuditLogPage";
import { ResolutionsPage } from "../pages/ResolutionsPage";
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
          <Route path="documents" element={<DocumentsListPage section="all" title="Документы" />} />
          <Route path="documents/new" element={<DocumentsListPage section="new" title="Новые" />} />
          <Route path="documents/current" element={<DocumentsListPage section="current" title="Текущие" />} />
          <Route path="documents/mine" element={<DocumentsListPage section="mine" title="Созданные мной" />} />
          <Route path="archive" element={<DocumentsListPage section="archive" title="Архив" />} />
          <Route path="documents/orders/new" element={<OrderBuilderPage />} />
          <Route path="documents/orders/:documentId/edit" element={<OrderBuilderPage />} />
          <Route path="documents/instructions/new" element={<InstructionBuilderPage />} />
          <Route path="documents/instructions/:documentId/edit" element={<InstructionBuilderPage />} />
          <Route path="documents/:documentId" element={<DocumentDetailPage />} />
          <Route path="incoming" element={<IncomingPage />} />
          <Route path="resolutions" element={<ResolutionsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
