export type UserRole =
  | "ADMIN"
  | "CHIEF"
  | "DEPARTMENT_HEAD"
  | "EMPLOYEE"
  | "INCOMING_DOC_OPERATOR"
  | "PERSONNEL_OFFICE";

export type DocumentType = "ORDER" | "INSTRUCTION" | "INCOMING_LETTER" | "RESOLUTION" | "ORDER_EXTRACT";

export type DocumentStatus =
  | "DRAFT"
  | "ON_APPROVAL"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "ON_ACKNOWLEDGEMENT"
  | "ACKNOWLEDGEMENT_COMPLETED"
  | "REGISTERED"
  | "ARCHIVED"
  | "SENT"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "UPLOADED"
  | "WAITING_RESOLUTION"
  | "RESOLUTION_CREATED"
  | "CLOSED"
  | "CREATED"
  | "RECEIVED";

export type DocumentAction =
  | "open"
  | "preview"
  | "edit"
  | "generate"
  | "approve"
  | "return_for_revision"
  | "send_for_approval"
  | "resubmit"
  | "send_for_acknowledgement"
  | "generate_extract"
  | "send"
  | "acknowledge";

export type User = {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
  department_id: number | null;
  position: string | null;
  is_active: boolean;
  is_approved: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: number;
  name: string;
  head_user_id: number | null;
  member_user_ids: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  user: User;
};

export type MeResponse = {
  user: User;
};

export type UserCreatePayload = {
  full_name: string;
  username: string;
  password: string;
  role: UserRole;
  department_id: number | null;
  position: string | null;
  is_active: boolean;
};

export type UserUpdatePayload = {
  full_name?: string;
  role?: UserRole;
  department_id?: number | null;
  position?: string | null;
  is_active?: boolean;
  is_approved?: boolean;
};

export type ApproveUserResponse = {
  message: string;
  user: User;
};

export type OneTimePasswordResponse = {
  message: string;
  temporary_password: string;
  user: User;
};

export type DepartmentCreatePayload = {
  name: string;
  head_user_id: number | null;
  member_user_ids: number[];
  is_active: boolean;
};

export type DepartmentUpdatePayload = {
  name?: string;
  head_user_id?: number | null;
  member_user_ids?: number[] | null;
  is_active?: boolean;
};

export type ChangePasswordPayload = {
  current_password?: string;
  new_password: string;
};

export type ApprovalStep = {
  id: number;
  step_order: number;
  approver_id: number;
  status: "PENDING" | "WAITING" | "APPROVED" | "RETURNED" | "SKIPPED";
  comment: string | null;
  acted_at: string | null;
  approver?: User | null;
};

export type Acknowledgement = {
  id: number;
  user_id: number;
  status: "PENDING" | "ACKNOWLEDGED";
  acknowledged_at: string | null;
  user?: User | null;
};

export type DocumentFile = {
  id: number;
  version: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  kind: "GENERATED_DOCX" | "GENERATED_PDF" | "EXTRACT_DOCX" | "EXTRACT_PDF";
  is_download_allowed: boolean;
  created_by: number;
  created_at: string;
};

export type StructuredOrderData = {
  order_subject: string;
  legal_basis_text: string;
  purpose_text: string;
  order_items: string[];
  control_assignee_text: string;
  approval_people: number[];
  acknowledgement_people: number[];
  acknowledgement_departments: number[];
  executor_name?: string | null;
  executor_phone?: string | null;
};

export type StructuredInstructionData = {
  instruction_subject: string;
  purpose_text: string;
  instruction_items: string[];
  participants: number[];
  participant_departments: number[];
  control_assignee_text: string;
  acknowledgement_people: number[];
  executor_name?: string | null;
  executor_phone?: string | null;
};

export type StructuredIncomingData = {
  sender: string;
  received_at: string;
  subject: string;
  body_text: string;
};

export type StructuredResolutionData = {
  linked_incoming_letter_id: number;
  resolution_text: string;
  assigned_users: number[];
  assigned_departments: number[];
  assignee_statuses: Record<string, string>;
};

export type Document = {
  id: number;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  author_id: number;
  department_id: number | null;
  current_version: number;
  registered_number: string | null;
  registered_date: string | null;
  document_date: string | null;
  city: string;
  organization_name: string;
  signer_position: string;
  signer_name: string;
  executor_name: string | null;
  executor_phone: string | null;
  structured_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  author?: User | null;
  department?: Department | null;
  files: DocumentFile[];
  approval_steps: ApprovalStep[];
  acknowledgements: Acknowledgement[];
  allowed_actions: DocumentAction[];
  requires_action: boolean;
};

export type BaseDocumentPayload = {
  title: string;
  department_id: number | null;
  registered_number?: string | null;
  registered_date?: string | null;
  document_date?: string | null;
  city?: string;
  organization_name?: string;
  signer_position: string;
  signer_name: string;
  executor_name?: string | null;
  executor_phone?: string | null;
};

export type OrderPayload = BaseDocumentPayload & {
  structured_data: StructuredOrderData;
};

export type InstructionPayload = BaseDocumentPayload & {
  structured_data: StructuredInstructionData;
};

export type IncomingPayload = {
  title: string;
  department_id: number | null;
  document_date?: string | null;
  organization_name: string;
  signer_position: string;
  signer_name: string;
  structured_data: StructuredIncomingData;
};

export type ResolutionPayload = {
  title: string;
  department_id: number | null;
  document_date?: string | null;
  organization_name: string;
  signer_position: string;
  signer_name: string;
  structured_data: StructuredResolutionData;
};

export type SendForApprovalPayload = {
  approver_ids: number[];
};

export type ReturnForRevisionPayload = {
  comment: string;
};

export type SendForAcknowledgementPayload = {
  user_ids: number[];
  department_ids: number[];
};

export type SendInstructionPayload = {
  acknowledgement_user_ids: number[];
  acknowledgement_department_ids: number[];
};

export type GenerateExtractPayload = {
  extracted_items: string[];
  certifier_position: string;
  certifier_name: string;
  extract_date: string;
};

export type DocumentGenerateResponse = {
  message: string;
  document: Document;
};

export type AuditLog = {
  id: number;
  actor_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor?: User | null;
};
