import type { DocumentStatus, DocumentType } from "../api/types";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ORDER: "Приказ",
  INSTRUCTION: "Приказание",
  INCOMING_LETTER: "Входящий документ",
  RESOLUTION: "Резолюция",
  ORDER_EXTRACT: "Выписка из приказа",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Черновик",
  ON_APPROVAL: "На согласовании",
  REVISION_REQUIRED: "Требуется доработка",
  APPROVED: "Согласован",
  ON_ACKNOWLEDGEMENT: "На ознакомлении",
  ACKNOWLEDGEMENT_COMPLETED: "Ознакомление завершено",
  REGISTERED: "Зарегистрирован",
  ARCHIVED: "Архив",
  SENT: "Отправлен",
  ACKNOWLEDGED: "Ознакомлен",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершен",
  UPLOADED: "Загружен",
  WAITING_RESOLUTION: "Ожидает резолюции",
  RESOLUTION_CREATED: "Резолюция создана",
  CLOSED: "Закрыт",
  CREATED: "Создан",
  RECEIVED: "Получен",
};
