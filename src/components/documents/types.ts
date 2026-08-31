import { Document, Task, WorkflowInstance } from '@/types/models';

/**
 * Fields the UI historically expected on a document that don't exist on the
 * real API response — comments, signatures, legal hold, and the sealed flag
 * have no backing endpoint at all (confirmed live: `POST /documents/{id}/comments`
 * and `/signatures` both 404). They're always empty/false in practice; kept
 * typed explicitly here rather than left as implicit `any` behind @ts-nocheck,
 * so the gap stays visible instead of silently disappearing.
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
