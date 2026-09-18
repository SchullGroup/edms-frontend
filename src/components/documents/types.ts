import { Document, Task, WorkflowInstance } from '@/types/models';

/**
 * Fields the UI historically expected on a document that don't exist on the
 * real API response. There is **no** document-level comments or signatures
 * endpoint — comments are the `comment` field on `POST /tasks/{taskId}/action`
 * and a signature is the `signature` image on that endpoint's `approve` action;
 * the document-level narrative comes from `GET /workflow-history`. `legalHold`
 * and `sealed` have no backing field either. All are empty/false in practice;
 * kept typed explicitly rather than left as implicit `any` so the gap stays
 * visible.
 */
export interface DocumentCommentUI {
  id?: string;
  text: string;
  createdBy?: string;
  createdAt?: string;
  creator?: { name: string };
}

export interface DocumentSignatureFieldUI {
  field?: string;
  fieldName?: string;
  page?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  signedBy?: string;
}

export interface DocumentWithUiExtras extends Document {
  comments: DocumentCommentUI[];
  signatures: DocumentSignatureFieldUI[];
  sealed: boolean;
  legalHold: boolean;
}

export type { Task, WorkflowInstance };
