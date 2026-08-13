// --- API Response Wrappers ---

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationInfo;
}

// --- Auth & Users ---

export type PermissionType =
  | string
  | {
      resource: string;
      action: string;
    };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  roles: string[];
  permissions?: PermissionType[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  departmentId?: string | null;
  roles?: { id: string; name: string; description?: string | null }[];
  permissions?: PermissionType[];
  preferences?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions?: {
    resource: 'document' | 'cabinet' | 'folder' | 'workflow' | 'audit' | 'user' | 'dashboard';
    action: 'view' | 'create' | 'edit' | 'delete' | 'route' | 'export' | 'download' | 'print';
  }[];
  createdAt: string;
  updatedAt: string;
}

// --- Documents ---

export interface Document {
  id: string;
  title: string;
  referenceNumber: string;
  cabinetId: string;
  folderId?: string | null;
  documentType?: string | null;
  status: 'pending' | 'in_progress' | 'on_hold' | 'closed';
  confidentiality: string; // 'public' | 'internal' | 'confidential' | 'restricted'
  urgency: string; // 'low' | 'normal' | 'high' | 'critical'
  isCheckedOut: boolean;
  archivedAt?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileKey: string;
  fileSize?: number | null;
  mimeType: string;
  checksum: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  uploadedBy: string;
  createdAt: string;
}

export interface CheckoutLock {
  id: string;
  documentId: string;
  lockedBy: string;
  lockedAt: string;
  expectedReturnAt?: string | null;
}

export interface DocumentMetadataField {
  fieldId: string;
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  isRequired: boolean;
  options?: string[] | null;
  displayOrder: number;
  value?: string | null;
}

// --- Workflows ---

export interface WorkflowStage {
  id: string;
  name: string;
  role?: string;
  user_id?: string;
  sla_hours: number;
  actions?: ('approve' | 'reject' | 'review' | 'request_changes' | 'close')[];
}

export interface WorkflowTransition {
  from: string;
  to: string;
}

export interface WorkflowDefinitionJson {
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  definition: WorkflowDefinitionJson;
  createdBy: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Cabinets ---

export interface CabinetFolder {
  id: string;
  name: string;
}

export interface Cabinet {
  id: string;
  name: string;
  icon?: string | null;
  folders: CabinetFolder[];
}

// --- Circulars ---

export interface Circular {
  id: string;
  title: string;
  body: string;
  published: number;
  by: string;
  requiresAck: boolean;
  ackBy: string[];
  audience: string;
  type?: string;
  urgent?: boolean;
}

// --- Policies ---

export interface PolicyControl {
  rule: string;
  desc: string;
  enabled: boolean;
}

export interface PolicyConfidentiality {
  level: string;
  requireEncryption: boolean;
  watermark: boolean;
  printAllowed: boolean;
}

export interface PolicyUrgency {
  level: string;
  slaHours: number;
  escalation: string;
}

export interface Policy {
  controls: PolicyControl[];
  confidentiality: PolicyConfidentiality[];
  urgency: PolicyUrgency[];
}

// --- Audit ---

export interface AuditLog {
  at: number;
  user: string;
  action: string;
  target: string;
  detail: string;
  tenant: string;
}

// --- Branding ---

export interface Branding {
  appName: string;
  tenantName: string;
  primary: string;
  primaryLight: string;
  accent: string;
  logoText: string;
}
