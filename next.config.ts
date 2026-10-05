import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The backend writes `actionUrl`s into notifications and emails using its own
   * path vocabulary (`edms-backend`: auth, documents, sla, tasks, instances
   * services), not this app's routes. These map the ones that translate by path
   * alone. They run before `proxy.ts`, so an email link still lands on the right
   * page (and then goes through auth as normal); query strings are carried over.
   *
   * `/tasks/:id` and `/workflow-instances/:id` need a lookup to find the document
   * — see `src/app/(app)/tasks/[id]` and `src/app/(app)/workflow-instances/[id]`.
   */
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: false },
      { source: "/reset-password", destination: "/set-password", permanent: false },
      {
        source: "/documents/:id/access-requests",
        destination: "/admin/access-requests",
        permanent: false,
      },
      { source: "/documents/:id", destination: "/doc/:id", permanent: false },
    ];
  },
};

export default nextConfig;
