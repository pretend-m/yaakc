import type { Workspace } from '@yaakapp-internal/models';
import { patchModel, settingsAtom } from '@yaakapp-internal/models';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { switchWorkspace } from '../commands/switchWorkspace';
import { Button } from './core/Button';
import { Checkbox } from './core/Checkbox';
import { Icon } from './core/Icon';
import { InlineCode } from './core/InlineCode';
import { HStack, VStack } from './core/Stacks';

interface Props {
  hide: () => void;
  workspace: Workspace;
}

export function SwitchWorkspaceDialog({ hide, workspace }: Props) {
  const settings = useAtomValue(settingsAtom);
  const [remember, setRemember] = useState<boolean>(false);

  return (
    <VStack space={3}>
      <p>
        您想在哪里打开 <InlineCode>{workspace.name}</InlineCode>?
      </p>
      <HStack space={2} justifyContent="start" className="flex-row-reverse">
        <Button
          className="focus"
          color="primary"
          onClick={async () => {
            hide();
            switchWorkspace.mutate({ workspaceId: workspace.id, inNewWindow: false });
            if (remember) {
              await patchModel(settings, { openWorkspaceNewWindow: false });
            }
          }}
        >
          当前窗口
        </Button>
        <Button
          className="focus"
          color="secondary"
          rightSlot={<Icon icon="external_link" />}
          onClick={async () => {
            hide();
            switchWorkspace.mutate({ workspaceId: workspace.id, inNewWindow: true });
            if (remember) {
              await patchModel(settings, { openWorkspaceNewWindow: true });
            }
          }}
        >
          新窗口
        </Button>
      </HStack>
      {settings && (
        <HStack justifyContent="end">
          <Checkbox checked={remember} title="记住我的选择" onChange={setRemember} />
        </HStack>
      )}
    </VStack>
  );
}
