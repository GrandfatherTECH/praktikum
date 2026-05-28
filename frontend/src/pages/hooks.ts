import { useQuery } from "@tanstack/react-query";

import { listDepartments } from "../api/departments";
import { getDocument, listAuditLogs, listDocuments, listIncoming, listResolutions } from "../api/documents";
import { listUsers } from "../api/users";
import type { DocumentType } from "../api/types";

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled,
  });
}

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });
}

export function useDocumentsQuery(section = "all", type?: DocumentType) {
  return useQuery({
    queryKey: ["documents", section, type ?? "all"],
    queryFn: () => listDocuments(section, type),
  });
}

export function useDocumentDetailQuery(documentId: number, enabled = true) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled,
  });
}

export function useIncomingQuery() {
  return useQuery({
    queryKey: ["incoming"],
    queryFn: listIncoming,
  });
}

export function useResolutionsQuery() {
  return useQuery({
    queryKey: ["resolutions"],
    queryFn: listResolutions,
  });
}

export function useAuditLogsQuery(enabled = true) {
  return useQuery({
    queryKey: ["audit"],
    queryFn: listAuditLogs,
    enabled,
  });
}
