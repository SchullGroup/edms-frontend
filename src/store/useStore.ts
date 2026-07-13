import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SEED, FINDINGS } from './initialData';

export { FINDINGS };

export type AppState = typeof SEED;

export interface AppStore extends AppState {
  setSession: (userId: string | null) => void;
  resetData: () => void;
  auditAction: (action: string, target: string, detail: string) => void;
  notifyUser: (
    userId: string,
    type: string,
    text: string,
    docId?: string,
    circularId?: string,
  ) => void;
  updateDocumentStatus: (docId: string, status: string) => void;
  updateDocument: (docId: string, updates: any) => void;
  currentUser?: any;
  setPrefs: (prefs: any) => void;
  updateUser: (userId: string, updates: any) => void;
  addUser: (user: any) => void;
  markCircularAck: (circularId: string) => void;
  updateRoleMatrix: (roleName: string, perms: any) => void;
  updatePolicyControl: (ruleName: string, enabled: boolean) => void;
  updatePolicyConfidentiality: (level: string, updates: any) => void;
  updatePolicyUrgency: (level: string, updates: any) => void;
  updateWorkflow: (wfId: string, updates: any) => void;
  addWorkflow: (wf: any) => void;
  updateCabinet: (cabId: string, updates: any) => void;
  addCabinet: (cab: any) => void;
  updateBranding: (updates: any) => void;
  updateCircular: (id: string, updates: any) => void;
  addCircular: (c: any) => void;
  updatePlan: (id: string, updates: any) => void;
  addPlan: (p: any) => void;
  updateTenant: (id: string, updates: any) => void;
  addTenant: (t: any) => void;
  updateFeatureFlag: (id: string, updates: any) => void;
  updateFinding: (id: string, updates: any) => void;
  addFinding: (f: any) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...SEED,
      findings: FINDINGS,
      setSession: (userId) => set({ session: userId }),
      setPrefs: (prefs) => set({ prefs }),
      resetData: () => set(SEED),
      auditAction: (action, target, detail) => {
        const { session, users, audit } = get();
        const me = users.find((u) => u.id === session);
        const newAudit = {
          at: Date.now(),
          user: me ? me.id : 'system',
          action,
          target,
          detail,
          tenant: 't-1',
        };
        set({ audit: [newAudit, ...audit] });
      },
      notifyUser: (userId, type, text, docId, circularId) => {
        const { notifications, seq } = get();
        const newSeq = seq + 1;
        const newNotification: any = {
          id: 'n-' + newSeq,
          user: userId,
          type,
          text,
          at: Date.now(),
          read: false,
          docId,
          circularId,
        };
        set({ notifications: [newNotification, ...notifications], seq: newSeq });
      },
      updateDocumentStatus: (docId, status) => {
        const { documents } = get();
        const newDocs = documents.map((d) => (d.id === docId ? { ...d, status } : d));
        set({ documents: newDocs });
      },
      updateDocument: (docId, updates) => {
        const { documents } = get();
        const newDocs = documents.map((d) => (d.id === docId ? { ...d, ...updates } : d));
        set({ documents: newDocs });
      },
      updateUser: (userId, updates) => {
        const { users } = get();
        const newUsers = users.map((u) => (u.id === userId ? { ...u, ...updates } : u));
        set({ users: newUsers });
      },
      addUser: (user) => {
        const { users } = get();
        set({ users: [...users, user] });
      },
      markCircularAck: (circularId) => {
        const { circulars, session } = get();
        if (!session) return;
        const newCir = circulars.map((c: any) => 
          c.id === circularId && !c.ackBy.includes(session) 
            ? { ...c, ackBy: [...c.ackBy, session] } 
            : c
        );
        set({ circulars: newCir });
      },
      updateRoleMatrix: (roleName, perms) => {
        const { rolesMatrix } = get();
        const newRoles = rolesMatrix.map((r: any) => (r.role === roleName ? { ...r, perms } : r));
        set({ rolesMatrix: newRoles });
      },
      updatePolicyControl: (ruleName, enabled) => {
        const { policies } = get();
        const newControls = policies.controls.map((c: any) => (c.rule === ruleName ? { ...c, enabled } : c));
        set({ policies: { ...policies, controls: newControls } });
      },
      updatePolicyConfidentiality: (level, updates) => {
        const { policies } = get();
        const newConf = policies.confidentiality.map((c: any) => (c.level === level ? { ...c, ...updates } : c));
        set({ policies: { ...policies, confidentiality: newConf } });
      },
      updatePolicyUrgency: (level, updates) => {
        const { policies } = get();
        const newUrg = policies.urgency.map((u: any) => (u.level === level ? { ...u, ...updates } : u));
        set({ policies: { ...policies, urgency: newUrg } });
      },
      updateWorkflow: (wfId, updates) => {
        const { workflows } = get();
        const newWf = workflows.map((w: any) => (w.id === wfId ? { ...w, ...updates } : w));
        set({ workflows: newWf });
      },
      addWorkflow: (wf) => {
        const { workflows } = get();
        set({ workflows: [...workflows, wf] });
      },
      updateCabinet: (cabId, updates) => {
        const { cabinets } = get();
        const newCab = cabinets.map((c: any) => (c.id === cabId ? { ...c, ...updates } : c));
        set({ cabinets: newCab });
      },
      addCabinet: (cab) => {
        const { cabinets } = get();
        set({ cabinets: [...cabinets, cab] });
      },
      updateBranding: (updates) => {
        set({ branding: { ...get().branding, ...updates } });
      },
      updateCircular: (id, updates) => {
        const { circulars } = get();
        const newCir = circulars.map((c: any) => (c.id === id ? { ...c, ...updates } : c));
        set({ circulars: newCir });
      },
      addCircular: (c) => {
        const { circulars } = get();
        set({ circulars: [c, ...circulars] });
      },
      updatePlan: (id, updates) => {
        const { plans } = get();
        const newPlans = plans.map((p: any) => (p.id === id ? { ...p, ...updates } : p));
        set({ plans: newPlans });
      },
      addPlan: (p) => {
        const { plans } = get();
        set({ plans: [p, ...plans] });
      },
      updateTenant: (id, updates) => {
        const { tenants } = get();
        const newTenants = tenants.map((t: any) => (t.id === id ? { ...t, ...updates } : t));
        set({ tenants: newTenants });
      },
      addTenant: (t) => {
        const { tenants } = get();
        set({ tenants: [t, ...tenants] });
      },
      updateFeatureFlag: (id, updates) => {
        const { featureFlags } = get();
        const newFlags = (featureFlags || []).map((f: any) => (f.id === id ? { ...f, ...updates } : f));
        set({ featureFlags: newFlags });
      },
      updateFinding: (id, updates) => {
        const { findings } = get();
        const newFindings = (findings || []).map((f: any) => (f.id === id ? { ...f, ...updates } : f));
        set({ findings: newFindings });
      },
      addFinding: (f) => {
        const { findings } = get();
        set({ findings: [f, ...(findings || [])] });
      },
    }),
    {
      name: 'edms-state-v3',
      version: 3,
    },
  ),
);

export const effStatus = (doc: any) => {
  if (doc.status === 'Closed' || doc.status === 'On Hold') return doc.status;
  if (doc.due && doc.due < Date.now()) return 'Overdue';
  return doc.status;
};

export const canView = (doc: any, user: any) => {
  if (!doc.restrictedTo) return true;
  return doc.restrictedTo.includes(user.id);
};

export const userById = (users: any[], id: string) =>
  users.find((u) => u.id === id) || {
    id,
    name: id === 'system' ? 'System' : 'Unknown',
    roleLabel: '',
  };

export const docById = (docs: any[], id: string) => docs.find((x) => x.id === id);
export const cabById = (cabs: any[], id: string) => cabs.find((c) => c.id === id);
export const folderName = (cabs: any[], cabId: string, fId: string) => {
  const c = cabById(cabs, cabId);
  const f = c && c.folders.find((f: any) => f.id === fId);
  return f ? f.name : '';
};
