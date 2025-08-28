import {
  grpcConnectionsAtom,
  httpResponsesAtom,
  websocketConnectionsAtom,
} from '@yaakapp-internal/models';
import { useAtomValue } from 'jotai';
import { showAlert } from '../lib/alert';
import { showConfirmDelete } from '../lib/confirm';
import { jotaiStore } from '../lib/jotai';
import { pluralizeCount } from '../lib/pluralize';
import { invokeCmd } from '../lib/tauri';
import { activeWorkspaceIdAtom } from './useActiveWorkspace';
import { useFastMutation } from './useFastMutation';

export function useDeleteSendHistory() {
  const httpResponses = useAtomValue(httpResponsesAtom);
  const grpcConnections = useAtomValue(grpcConnectionsAtom);
  const websocketConnections = useAtomValue(websocketConnectionsAtom);

  const labels = [
    httpResponses.length > 0 ? pluralizeCount('Http Response', httpResponses.length) : null,
    grpcConnections.length > 0 ? pluralizeCount('Grpc Connection', grpcConnections.length) : null,
    websocketConnections.length > 0
      ? pluralizeCount('WebSocket Connection', websocketConnections.length)
      : null,
  ].filter((l) => l != null);

  return useFastMutation({
    mutationKey: ['delete_send_history', labels],
    mutationFn: async () => {
      if (labels.length === 0) {
        showAlert({
          id: 'no-responses',
          title: '没有可删除的内容',
          body: '当前没有Http,Grpc或Websocket的历史记录',
        });
        return;
      }

      const confirmed = await showConfirmDelete({
        id: 'delete-send-history',
        title: '清除发送历史记录',
        description: <>确认删除 {labels.join(' 和 ')}?</>,
        confirmText: '删除',
        cancelText: '取消',
      });
      if (!confirmed) return false;

      const workspaceId = jotaiStore.get(activeWorkspaceIdAtom);
      await invokeCmd('cmd_delete_send_history', { workspaceId });
      return true;
    },
  });
}
