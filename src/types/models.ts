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
  /** What `GET /users` actually returns — the join rows, not a flat `roles` array. */
  userRoles?: { userId: string; roleId: string; role: Role }[];
  permissions?: PermissionType[];
  preferences?: Record<string, any> | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type RolePermissionResource =
  'document' | 'cabinet' | 'folder' | 'workflow' | 'audit' | 'user' | 'dashboard';

export type RolePermissionAction =
  'view' | 'create' | 'edit' | 'delete' | 'route' | 'export' | 'download' | 'print';

export type RolePermission = {
  resource: RolePermissionResource;
  action: RolePermissionAction;
};

/** Body for `POST /roles`. `name` 1–100 chars, `description` max 500. */
export interface CreateRoleRequest {
  name: string;
  description?: string;
}

/** Body for `PATCH /roles/{id}`. At least one field required. */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

/** Body for `PUT /roles/{id}/permissions` — replaces the whole permission set. */
export interface SetPermissionsRequest {
  permissions: RolePermission[];
}

/** Body for `POST /users/{id}/roles`. */
export interface AssignRolesRequest {
  roleIds: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  /** Flattened by `rolesService` from the API's actual `rolePermissions[].permission`
   *  shape — the Swagger schema documents a flat `permissions` array, but the live
   *  response nests it under the raw Prisma join instead. */
  permissions?: RolePermission[];
  isSystemRole?: boolean;
  createdAt: string;
  updatedAt?: string;
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
  /** Only observed as present (non-null) while checked out — shape unconfirmed
   *  live since no fixture document was in that state when this was checked. */
  checkoutLock?: CheckoutLock | null;
  archivedAt?: string | null;
  createdBy: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  currentVersionId?: string | null;
  currentVersion?: DocumentVersion;
  metadata?: DocumentMetadataField[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileKey: string;
  /**
   * Short-lived pre-signed download URL for `fileKey`, minted by the backend.
   * Observed on `currentVersion` from `GET /documents/{id}` (expires ~15 min).
   * Not guaranteed on version-list responses, so treat as optional.
   */
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType: string;
  checksum: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText?: string | null;
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

export type DocumentConfidentiality =
  'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';

export type DocumentUrgency = 'low' | 'normal' | 'high' | 'critical';

export type DocumentStatus = 'pending' | 'in_progress' | 'on_hold' | 'closed';

/**
 * Body for `POST /documents`. The file is uploaded to storage (S3) by the
 * client first; this only registers the record. `checksum` is the SHA-256 of
 * the file content.
 */
export interface UploadDocumentRequest {
  title: string;
  fileUrl: string;
  mimeType: string;
  checksum: string;
  cabinetId: string;
  confidentiality: DocumentConfidentiality;
  urgency: DocumentUrgency;
  fileSize?: number;
  documentType?: string;
  folderId?: string;
}

/** Body for `PATCH /documents/{id}`. At least one field required. */
export interface UpdateDocumentRequest {
  title?: string;
  documentType?: string;
  folderId?: string;
  confidentiality?: DocumentConfidentiality;
  urgency?: DocumentUrgency;
  status?: DocumentStatus;
}

/** Body for `POST /documents/{id}/versions`. Same upload-first contract as {@link UploadDocumentRequest}. */
export interface CreateVersionRequest {
  fileUrl: string;
  mimeType: string;
  checksum: string;
  fileSize?: number;
}

/** One entry in the `PUT /documents/{id}/metadata` body (a raw array). */
export interface DocumentMetadataValueInput {
  fieldId: string;
  value: string | number | boolean | null;
}

// --- Workflows ---

export type WorkflowStageAction =
  'approve' | 'reject' | 'review' | 'request_changes' | 'close' | 'delegate';

export type WorkflowStageType =
  'start' | 'review' | 'approval' | 'sign' | 'condition' | 'parallel' | 'notify' | 'close';

export interface WorkflowStage {
  id: string;
  name: string;
  role?: string;
  user_id?: string;
  sla_hours: number;
  /** Designer-authored stage kind. Persisted by the backend alongside `actions`. */
  type?: WorkflowStageType;
  actions?: WorkflowStageAction[];
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

export type WorkflowInstanceStatus = 'pending' | 'in_progress' | 'on_hold' | 'closed';

/** Shared by `WorkflowInstance` and `TaskWorkflowInstance` — the workflow
 *  definition summary both embed. */
export interface WorkflowDefinitionSummary {
  id: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  definition?: WorkflowDefinitionJson;
}

export interface WorkflowInstance {
  id: string;
  workflowDefinitionId: string;
  documentId: string;
  document?: Document;
  status: WorkflowInstanceStatus;
  currentStage?: string | null;
  stageDueAt?: string | null;
  startedAt: string;
  closedAt?: string | null;
  tasks?: Task[];
  /** Present on `GET /workflow-instances/{id}` (confirmed live) — not
   *  documented on this schema, and not present on the list response. */
  workflowDefinition?: WorkflowDefinitionSummary;
}

/** Body for `POST /workflow-instances` — creates a pending instance. */
export interface CreateWorkflowInstanceRequest {
  documentId: string;
  workflowDefinitionId: string;
}

/** `data` shape of `GET /workflow-instances/stats`. */
export interface WorkflowInstanceStatsResponse {
  buckets: { key: string; count: number }[];
  avgTurnaroundDays: number;
}

/**
 * `data` shape of `GET /workflow-instances/status-counts` — dashboard-friendly
 * instance counts using the same access scoping as the instance list.
 * `inProgress` includes `on_hold`; `onHold` is a subset of it, not additional.
 */
export interface WorkflowInstanceStatusCounts {
  pending: number;
  inProgress: number;
  onHold: number;
  closed: number;
  total: number;
}

/** One row of `GET /workflow-instances/team-status-matrix`. */
export interface WorkflowTeamStatusMember {
  memberId: string;
  memberName: string;
  memberEmail: string;
  departmentId: string | null;
  departmentName: string | null;
  pending: number;
  /** Files whose document status is `in_progress` or `on_hold`. */
  inProgress: number;
  /** Subset of `inProgress` whose active instance's `stageDueAt` has passed. */
  overdue: number;
  closed: number;
  total: number;
}

/** One row of `GET /workflow-instances/open-items-by-cabinet`. */
export interface WorkflowOpenItemsByCabinetItem {
  cabinetId: string;
  cabinetName: string;
  departmentId: string | null;
  departmentName: string | null;
  pending: number;
  inProgress: number;
  /** Subset of `inProgress`. */
  onHold: number;
  /** Subset of `inProgress`. */
  overdue: number;
  /** `pending + inProgress`. `onHold`/`overdue` are subsets, not added again. */
  openItems: number;
}

/** `data` shape of `GET /workflow-instances/open-items-by-cabinet`. */
export interface WorkflowOpenItemsByCabinetData {
  cabinets: WorkflowOpenItemsByCabinetItem[];
  totalOpenItems: number;
}

export type SlaStatus = 'healthy' | 'due_soon' | 'breached' | 'paused' | 'not_started';

/** Summary counts for `GET /workflow-instances/bottlenecks-ageing`. */
export interface WorkflowBottlenecksAgeingSummary {
  totalOpenItems: number;
  breachedItems: number;
  dueSoonItems: number;
  healthyItems: number;
  pausedItems: number;
  notStartedItems: number;
  /** Hours before SLA expiry that an item is classified `due_soon`. */
  slaWarningHours: number;
}

export interface WorkflowAgeingDistributionBucket {
  bucket: '0_3_days' | '4_7_days' | '8_14_days' | '15_plus_days';
  label: string;
  count: number;
}

export interface WorkflowStageDistributionItem {
  stage: string;
  stageName: string;
  count: number;
}

/**
 * One active workflow item on the Bottlenecks & Ageing dashboard.
 * `workflowStatus` (process state) and `slaStatus` (time-risk state) are
 * deliberately separate fields — never merge them into one chip.
 */
export interface WorkflowBottleneckItem {
  workflowInstanceId: string;
  documentId: string;
  documentTitle: string;
  referenceNumber: string | null;
  documentStatus: string;
  confidentiality: string;
  urgency: string;
  cabinetId: string;
  cabinetName: string;
  departmentId: string | null;
  departmentName: string | null;
  currentStage: string;
  currentStageName: string;
  workflowStatus: 'pending' | 'in_progress' | 'on_hold';
  currentTaskId: string | null;
  assignmentType: 'user' | 'role' | 'unassigned';
  assigneeId: string | null;
  /** User name, role name, or `Unassigned`. */
  assigneeName: string;
  assigneeEmail: string | null;
  assignedRoleId: string | null;
  assignedRoleName: string | null;
  stageEnteredAt: string;
  ageDays: number;
  slaDueAt: string | null;
  slaStatus: SlaStatus;
  /** True when a current active task exists and can be reassigned. */
  canReassign: boolean;
}

/** `data` shape of `GET /workflow-instances/bottlenecks-ageing`. */
export interface WorkflowBottlenecksAgeingData {
  summary: WorkflowBottlenecksAgeingSummary;
  ageingDistribution: WorkflowAgeingDistributionBucket[];
  stageDistribution: WorkflowStageDistributionItem[];
  items: WorkflowBottleneckItem[];
  pagination: PaginationInfo;
}

/** A read-only `GET /workflow-history` row. */
export interface WorkflowHistoryRecord {
  id: string;
  workflowInstanceId: string;
  taskId?: string | null;
  fromStage?: string | null;
  toStage?: string | null;
  /** e.g. `workflow_started`, `review`, `approve`, `task_reassigned`, `workflow_closed`. */
  action: string;
  actorId?: string | null;
  note?: string | null;
  elapsedSeconds?: number | null;
  occurredAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    status: string;
  } | null;
  task?: Record<string, any> | null;
  workflowInstance?: Record<string, any>;
}

/**
 * The narrow document projection embedded in a task returned by `GET /tasks`.
 * The backend selects only these columns — it is not a full `Document`.
 */
export interface TaskDocumentSummary {
  id: string;
  title: string;
  status: Document['status'];
  confidentiality: string;
  urgency: string;
  cabinetId: string;
}

export interface TaskWorkflowInstance {
  id: string;
  documentId: string;
  workflowDefinitionId: string;
  currentStage: string;
  status: WorkflowInstanceStatus;
  stageDueAt?: string | null;
  startedAt?: string | null;
  closedAt?: string | null;
  document: TaskDocumentSummary;
  workflowDefinition: WorkflowDefinitionSummary;
}

export type TaskStatus = 'pending' | 'completed' | 'reassigned' | 'delegated' | 'escalated';

export interface TaskUserSummary {
  id: string;
  name: string;
  email: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface Task {
  id: string;
  workflowInstanceId: string;
  stage: string;
  assigneeId?: string | null;
  assignedRoleId?: string | null;
  action?: string | null;
  status: TaskStatus;
  dueAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  note?: string | null;
  createdAt: string;
  assignee?: TaskUserSummary | null;
  assignedRole?: { id: string; name: string } | null;
  completer?: TaskUserSummary | null;
  workflowInstance: TaskWorkflowInstance;
}

export type TaskActionRequest =
  | { action: Exclude<WorkflowStageAction, 'delegate'>; note?: string }
  | {
      action: 'delegate';
      /** Who the replacement task goes to. The workflow stays at the current
       *  stage — this doesn't advance anything, just hands off the task. */
      delegateId: string;
      note?: string;
    };

/** Body for `PATCH /tasks/{taskId}/reassign`. */
export interface ReassignTaskRequest {
  assigneeId: string;
  note?: string;
}

/** `data` shape of `GET /tasks/stats` — completed-task SLA rollup by department. */
export interface TaskSlaStatsResponse {
  buckets: {
    departmentId?: string | null;
    departmentName?: string | null;
    total: number;
    onTime: number;
    overdue: number;
    /** `onTime / total * 100`. */
    slaRate: number;
  }[];
}

/**
 * Per-member row of `GET /tasks/workload`. Only directly assigned, active,
 * current-stage tasks count toward a member's workload — role-pool tasks are
 * deliberately not duplicated across every holder of the role.
 */
export interface TaskWorkloadMember {
  memberId: string;
  memberName: string;
  memberEmail: string;
  departmentId: string | null;
  departmentName: string | null;
  roles: string[];
  open: number;
  /** Subset of `open` whose `dueAt` has passed. */
  overdue: number;
  /** Phase-1 fixed capacity per member (currently 8). */
  capacity: number;
  /** `max(capacity - open, 0)`. */
  availableCapacity: number;
  /** `open / capacity * 100`. Can exceed 100 when overloaded. */
  utilizationPercent: number;
}

export interface TaskWorkloadSummary {
  totalMembers: number;
  totalOpen: number;
  totalOverdue: number;
  totalCapacity: number;
  overallUtilizationPercent: number;
}

/** `data` shape of `GET /tasks/workload`. */
export interface TaskWorkloadData {
  members: TaskWorkloadMember[];
  summary: TaskWorkloadSummary;
}

/** One row of `GET /sla/breaches` — a persisted SLA warning/escalation event. */
export interface SlaBreach {
  id: string;
  workflowInstanceId: string;
  taskId: string;
  breachType: 'warning' | 'escalation';
  notifiedAt: string;
  resolvedAt: string | null;
  /** Task and assignment context for the event. */
  task?: Record<string, any>;
  /** Workflow, document and current-stage context for the event. */
  workflowInstance?: Record<string, any>;
}

// --- Delegations ---

export interface DelegationScope {
  cabinets?: string[];
  workflows?: string[];
}

export interface Delegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  startsAt: string;
  endsAt: string;
  /** `null` means all workflow tasks. */
  scope?: DelegationScope | null;
  isActive: boolean;
  createdAt: string;
}

/** Body for `POST /delegations`. */
export interface CreateDelegationRequest {
  delegateId: string;
  startsAt: string;
  endsAt: string;
  scope?: DelegationScope | null;
}

// --- Notifications ---

export type NotificationChannel = 'in_app' | 'email';

export type NotificationStatus = 'pending' | 'sent' | 'read' | 'failed';

/** Server-rendered contents of a notification. The backend documents it only as
 *  "rendered title, message, and deep-link action URL", so every key is optional
 *  and unknown extras are preserved. */
export interface NotificationPayload {
  title?: string;
  message?: string;
  /** Deep link into the app, e.g. `/doc/{id}`. May be absolute. */
  actionUrl?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  /** Recipient. Present on the wire; not needed by the client since
   *  `/notifications` is already scoped to the authenticated user. */
  userId?: string;
  /** Event key such as `task.assigned`, `workflow.closed`, `workflow.on_hold`. */
  type: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: NotificationPayload;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  id?: string;
  userId?: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  digestMode: boolean;
  updatedAt?: string | null;
}

/** Body for `PUT /notifications/preferences`. */
export interface UpdateNotificationPreferencesRequest {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  digestMode?: boolean;
}

// --- Departments ---

export interface Department {
  id: string;
  name: string;
  parentId?: string | null;
  children?: Department[];
  parent?: Department | null;
  createdAt: string;
  updatedAt?: string | null;
}

/** Body for `POST /departments`. `name` max 150. */
export interface CreateDepartmentRequest {
  name: string;
  /** Parent department UUID. Omit for a root-level department. */
  parentId?: string;
}

/** Body for `PATCH /departments/{id}`. Any subset; `parentId: null` makes it root. */
export interface UpdateDepartmentRequest {
  name?: string;
  parentId?: string | null;
}

// --- Cabinets ---

/** Full cabinet folder — matches Swagger's `Folder` schema (hierarchical). */
export interface Folder {
  id: string;
  name: string;
  cabinetId: string;
  parentId?: string | null;
  createdBy?: string;
  children?: Folder[];
  parent?: Folder | null;
  _count?: {
    documents: number;
  };
  createdAt?: string;
  updatedAt?: string | null;
}

/** @deprecated Use {@link Folder}. Kept as an alias so existing imports compile. */
export type CabinetFolder = Folder;

/** Body for `POST /cabinets/{cabinetId}/folders`. `name` max 200. */
export interface CreateFolderRequest {
  name: string;
  /** Parent folder UUID. Omit for a top-level folder in the cabinet. */
  parentId?: string;
}

/** Body for `PATCH /folders/{id}`. `parentId: null` promotes to top-level. */
export interface UpdateFolderRequest {
  name?: string;
  parentId?: string | null;
}

export type CabinetMetadataFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

export interface CabinetMetadataField {
  id: string;
  cabinetId: string;
  name: string;
  fieldType: CabinetMetadataFieldType;
  isRequired: boolean;
  options?: string[] | null;
  displayOrder: number;
}

/** Body for `POST /cabinets/{id}/metadata-fields`. `options` only for `select`. */
export interface CreateMetadataFieldRequest {
  name: string;
  fieldType: CabinetMetadataFieldType;
  isRequired?: boolean;
  options?: string[];
  displayOrder?: number;
}

/** Body for `PATCH /cabinets/{id}/metadata-fields/{fieldId}`. Any subset. */
export type UpdateMetadataFieldRequest = Partial<CreateMetadataFieldRequest>;

/**
 * Cabinet-scoped permission verbs (`GET/POST /cabinets/{id}/access`).
 * Note: distinct from {@link RolePermission}'s `action` set.
 */
export type CabinetAccessPermission = 'view' | 'upload' | 'edit' | 'route' | 'export' | 'delete';

export interface CabinetAccessGrant {
  id: string;
  cabinetId: string;
  permission: CabinetAccessPermission;
  roleId?: string | null;
  userId?: string | null;
  /** Embedded on the list response when the grant targets a role. */
  role?: { id: string; name: string } | null;
  /** Embedded on the list response when the grant targets a user. */
  user?: { id: string; name: string; email: string } | null;
}

/** Body for `POST /cabinets/{id}/access`. Exactly one of `roleId` / `userId`. */
export interface GrantAccessRequest {
  permission: CabinetAccessPermission;
  roleId?: string;
  userId?: string;
}

/** Body for `POST /cabinets`. `name` max 200, `description` max 1000. */
export interface CreateCabinetRequest {
  name: string;
  description?: string;
  departmentId?: string;
  retentionPolicyId?: string;
}

/** Body for `PATCH /cabinets/{id}`. Any subset; nulls detach the relation. */
export interface UpdateCabinetRequest {
  name?: string;
  description?: string;
  departmentId?: string | null;
  retentionPolicyId?: string | null;
}

export interface Cabinet {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  retentionPolicyId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
  department?: Department | null;
  retentionPolicy?: any | null;
  icon?: string | null;
  /** Only present on `GET /cabinets/{id}` — not documented in Swagger's `Cabinet`
   *  schema, and never on the `GET /cabinets` list, but confirmed embedded on the
   *  live single-cabinet response. */
  metadataFields?: CabinetMetadataField[];
  _count?: {
    documents: number;
    folders?: number;
  };
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
