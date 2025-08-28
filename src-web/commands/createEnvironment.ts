import { createWorkspaceModel, type Environment } from '@yaakapp-internal/models';
import { activeWorkspaceIdAtom } from '../hooks/useActiveWorkspace';
import { createFastMutation } from '../hooks/useFastMutation';
import { jotaiStore } from '../lib/jotai';
import { showPrompt } from '../lib/prompt';
import { setWorkspaceSearchParams } from '../lib/setWorkspaceSearchParams';

export const createEnvironmentAndActivate = createFastMutation<
  string | null,
  unknown,
  Environment | null
>({
  mutationKey: ['create_environment'],
  mutationFn: async (baseEnvironment) => {
    if (baseEnvironment == null) {
      throw new Error('未通过基础环境');
    }

    const workspaceId = jotaiStore.get(activeWorkspaceIdAtom);
    if (workspaceId == null) {
      throw new Error('没有工作区时无法创建环境');
    }

    const name = await showPrompt({
      id: 'new-environment',
      title: '新环境',
      description: '创建多个环境，并为每个环境设置不同的变量值',
      label: '名称',
      placeholder: '我的环境',
      defaultValue: '我的环境',
      confirmText: '创建',
      cancelText: '取消'
    });
    if (name == null) return null;

    return createWorkspaceModel({
      model: 'environment',
      name,
      variables: [],
      workspaceId,
      base: false,
    });
  },
  onSuccess: async (environmentId) => {
    if (environmentId == null) {
      return; // Was not created
    }

    console.log('NAVIGATING', jotaiStore.get(activeWorkspaceIdAtom), environmentId);
    setWorkspaceSearchParams({ environment_id: environmentId });
  },
});
