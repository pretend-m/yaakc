import type { Folder } from '@yaakapp-internal/models';
import { patchModel } from '@yaakapp-internal/models';
import { useMemo } from 'react';
import { IconTooltip } from '../components/core/IconTooltip';
import { HStack } from '../components/core/Stacks';
import type { TabItem } from '../components/core/Tabs/Tabs';
import { useHttpAuthenticationSummaries } from './useHttpAuthentication';
import type { AuthenticatedModel} from './useInheritedAuthentication';
import { useInheritedAuthentication } from './useInheritedAuthentication';

export function useAuthTab<T extends string>(tabValue: T, model: AuthenticatedModel | null) {
  const authentication = useHttpAuthenticationSummaries();
  const inheritedAuth = useInheritedAuthentication(model);

  return useMemo<TabItem[]>(() => {
    if (model == null) return [];

    const tab: TabItem = {
      value: tabValue,
      label: 'Auth',
      options: {
        value: model.authenticationType,
        items: [
          ...authentication.map((a) => ({
            label: a.label || 'UNKNOWN',
            shortLabel: a.shortLabel,
            value: a.name,
          })),
          { type: 'separator' },
          {
            label: '从父级继承',
            shortLabel:
              inheritedAuth != null && inheritedAuth.authenticationType != 'none' ? (
                <HStack space={1.5}>
                  {authentication.find((a) => a.name === inheritedAuth.authenticationType)
                    ?.shortLabel ?? 'UNKNOWN'}
                  <IconTooltip
                    icon="magic_wand"
                    iconSize="xs"
                    content="身份验证继承自上级/父级配置"
                  />
                </HStack>
              ) : (
                '从父级继承'
              ),
            value: null,
          },
          { label: '无认证', value: 'none' },
        ],
        onChange: async (authenticationType) => {
          let authentication: Folder['authentication'] = model.authentication;
          if (model.authenticationType !== authenticationType) {
            authentication = {
              // Reset auth if changing types
            };
          }
          await patchModel(model, { authentication, authenticationType });
        },
      },
    };

    return [tab];
  }, [authentication, inheritedAuth, model, tabValue]);
}
