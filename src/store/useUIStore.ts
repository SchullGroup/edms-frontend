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
  /**
   * Return a Promise to keep the modal open (with a loading state on this
   * button) until it settles. The modal closes on resolve and stays open on
   * reject so the user can see the error and retry. Returning `false`
   * (sync or resolved) also keeps the modal open.
   */
  onClick?: () => boolean | void | Promise<boolean | void>;
}

export interface ModalConfig {
  title: string;
  body: React.ReactNode;
  actions?: ModalAction[];
  size?: string;
}

export interface DrawerConfig {
  title: string;
  body: React.ReactNode;
  foot?: React.ReactNode;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Return a Promise (e.g. `mutateAsync(...)`) to show a loading state on the confirm button until it settles. */
  onConfirm: () => void | Promise<void>;
}

interface UIStore {
  toasts: Toast[];
  addToast: (message: string, kind?: Toast['kind']) => void;
  removeToast: (id: string) => void;
  modal: ModalConfig | null;
  openModal: (config: ModalConfig) => void;
  openConfirm: (config: ConfirmConfig) => void;
  closeModal: () => void;
  drawer: DrawerConfig | null;
  openDrawer: (config: DrawerConfig) => void;
  closeDrawer: () => void;
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
          // Returned as-is: if this is a Promise, UIProviders shows a loading
          // state on the button and only closes the modal once it resolves.
          onClick: () => config.onConfirm(),
        }
      ]
    }
  }),
  closeModal: () => set({ modal: null }),
  drawer: null,
  openDrawer: (drawer) => set({ drawer }),
  closeDrawer: () => set({ drawer: null }),
  pageTitle: 'Dashboard',
  setPageTitle: (pageTitle) => set({ pageTitle }),
}));
