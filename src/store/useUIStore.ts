import { create } from 'zustand';
import React from 'react';

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info' | 'warning';
}

export interface ModalAction {
  label: string;
  kind?: string;
  disabled?: boolean;
  onClick?: () => boolean | void;
}

export interface ModalConfig {
  title: string;
  body: React.ReactNode;
  actions?: ModalAction[];
  size?: string;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface UIStore {
  toasts: Toast[];
  addToast: (message: string, kind?: Toast['kind']) => void;
  removeToast: (id: string) => void;
  modal: ModalConfig | null;
  openModal: (config: ModalConfig) => void;
  openConfirm: (config: ConfirmConfig) => void;
  closeModal: () => void;
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  addToast: (message, kind = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3800);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  modal: null,
  openModal: (modal) => set({ modal }),
  openConfirm: (config) => set({
    modal: {
      title: config.title,
      body: React.createElement('div', { style: { marginBottom: '16px' } }, config.message),
      actions: [
        { label: 'Cancel' },
        { 
          label: config.confirmLabel || 'Confirm', 
          kind: config.danger ? 'btn-danger' : 'btn-primary', 
          onClick: () => {
            config.onConfirm();
            set({ modal: null });
          } 
        }
      ]
    }
  }),
  closeModal: () => set({ modal: null }),
  pageTitle: 'Dashboard',
  setPageTitle: (pageTitle) => set({ pageTitle }),
}));
