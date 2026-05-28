import { apiRequest } from "./client";
import type {
  AuditLog,
  Document,
  DocumentGenerateResponse,
  DocumentType,
  GenerateExtractPayload,
  IncomingPayload,
  InstructionPayload,
  OrderPayload,
  ResolutionPayload,
  ReturnForRevisionPayload,
  SendForAcknowledgementPayload,
  SendForApprovalPayload,
  SendInstructionPayload,
} from "./types";

export function listDocuments(section = "all", type?: DocumentType) {
  const params = new URLSearchParams();
  params.set("section", section);
  if (type) {
    params.set("type", type);
  }
  return apiRequest<Document[]>(`/documents?${params.toString()}`);
}

export function getDocument(documentId: number) {
  return apiRequest<Document>(`/documents/${documentId}`);
}

export function createOrder(payload: OrderPayload) {
  return apiRequest<Document>("/documents/orders", { method: "POST", body: payload });
}

export function updateOrder(documentId: number, payload: Partial<OrderPayload>) {
  return apiRequest<Document>(`/documents/orders/${documentId}`, { method: "PATCH", body: payload });
}

export function generateOrder(documentId: number) {
  return apiRequest<DocumentGenerateResponse>(`/documents/orders/${documentId}/generate`, { method: "POST" });
}

export function sendOrderForApproval(documentId: number, payload: SendForApprovalPayload) {
  return apiRequest<Document>(`/documents/orders/${documentId}/send-for-approval`, { method: "POST", body: payload });
}

export function createInstruction(payload: InstructionPayload) {
  return apiRequest<Document>("/documents/instructions", { method: "POST", body: payload });
}

export function updateInstruction(documentId: number, payload: Partial<InstructionPayload>) {
  return apiRequest<Document>(`/documents/instructions/${documentId}`, { method: "PATCH", body: payload });
}

export function generateInstruction(documentId: number) {
  return apiRequest<DocumentGenerateResponse>(`/documents/instructions/${documentId}/generate`, { method: "POST" });
}

export function sendInstruction(documentId: number, payload: SendInstructionPayload) {
  return apiRequest<Document>(`/documents/instructions/${documentId}/send`, { method: "POST", body: payload });
}

export function approveDocument(documentId: number, comment?: string) {
  return apiRequest<Document>(`/documents/${documentId}/approve`, { method: "POST", body: { comment } });
}

export function returnForRevision(documentId: number, payload: ReturnForRevisionPayload) {
  return apiRequest<Document>(`/documents/${documentId}/return-for-revision`, { method: "POST", body: payload });
}

export function resubmitDocument(documentId: number) {
  return apiRequest<Document>(`/documents/${documentId}/resubmit`, { method: "POST" });
}

export function sendForAcknowledgement(documentId: number, payload: SendForAcknowledgementPayload) {
  return apiRequest<Document>(`/documents/${documentId}/send-for-acknowledgement`, { method: "POST", body: payload });
}

export function acknowledgeDocument(documentId: number) {
  return apiRequest<Document>(`/documents/${documentId}/acknowledge`, { method: "POST" });
}

export function generateExtract(documentId: number, payload: GenerateExtractPayload) {
  return apiRequest<Document>(`/documents/${documentId}/generate-extract`, { method: "POST", body: payload });
}

export function previewDocumentUrl(documentId: number) {
  return `/api/v1/documents/${documentId}/preview`;
}

export function downloadDocumentFileUrl(documentId: number, fileId: number) {
  return `/api/v1/documents/${documentId}/files/${fileId}/download`;
}

export function listIncoming() {
  return apiRequest<Document[]>("/incoming");
}

export function createIncoming(payload: IncomingPayload) {
  return apiRequest<Document>("/incoming", { method: "POST", body: payload });
}

export function createResolution(incomingId: number, payload: ResolutionPayload) {
  return apiRequest<Document>(`/incoming/${incomingId}/resolution`, { method: "POST", body: payload });
}

export function listResolutions() {
  return apiRequest<Document[]>("/resolutions");
}

export function takeResolutionInWork(documentId: number) {
  return apiRequest<Document>(`/resolutions/${documentId}/take-in-work`, { method: "POST" });
}

export function completeResolution(documentId: number) {
  return apiRequest<Document>(`/resolutions/${documentId}/complete`, { method: "POST" });
}

export function listAuditLogs() {
  return apiRequest<AuditLog[]>("/audit");
}
