import { useCallback } from 'react';
import { CreateWorkspaceDialog } from '../components/CreateWorkspaceDialog';
import { showDialog } from '../lib/dialog';

export function useCreateWorkspace() {
  return useCallback(() => {
    showDialog({
      id: 'create-workspace',
      title: '创建工作区',
      size: 'sm',
      render: ({ hide }) => <CreateWorkspaceDialog hide={hide} />,
    });
  }, []);
}
