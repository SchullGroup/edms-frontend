'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { WorkflowInstanceMonitor } from '@/components/workflowInstances/WorkflowInstanceMonitor';

export default function WorkflowMonitorPage() {
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Workflow Monitor');
  }, [setPageTitle]);

  return <WorkflowInstanceMonitor />;
}
