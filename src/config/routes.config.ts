export interface RouteRule {
  path: string;
  matchType: 'exact' | 'prefix' | 'whitelist';
  roles?: string[];
  permissions?: string[];
  exclude?: string[];
  include?: string[];
}

export const routeConfig: RouteRule[] = [
  // 1. PREFIX: Match the base path and ALL subroutes
  {
    path: '/platform',
    matchType: 'prefix',
    roles: ['schulltech_admin'],
  },

  // 2. WHITELIST: Match the base path, and ONLY explicitly included subroutes
  {
    path: '/management',
    matchType: 'whitelist',
    roles: ['management'],
    include: [
      '/management/reports',
      '/management/compliance',
      '/management/departments',
      '/management/trends',
      '/management/performance',
      '/management/findings',
    ],
  },

  // 3. PREFIX: Match the base path and ALL subroutes, minus exclusions
  {
    path: '/staff',
    matchType: 'prefix',
    roles: ['staff', 'supervisor', 'management', 'internal_auditor'],
    exclude: ['/staff/restricted-example'], // Add explicit exceptions here if needed
  },

  // High-level portals
  {
    path: '/admin',
    matchType: 'prefix',
    roles: ['client_admin'],
  },

  {
    path: '/auditor',
    matchType: 'prefix',
    roles: ['internal_auditor'],
  },

  {
    path: '/supervisor',
    matchType: 'prefix',
    roles: ['supervisor', 'management'],
  },

  // 4. Global authenticated paths (No roles specified = any authenticated user)
  { path: '/search', matchType: 'prefix' },
  { path: '/circulars', matchType: 'prefix' },
  { path: '/notifications', matchType: 'prefix' },
  { path: '/doc', matchType: 'prefix' }, // viewing a document
  {
    path: '/upload',
    matchType: 'prefix',
    roles: ['staff', 'supervisor', 'management', 'client_admin'],
  },
];
