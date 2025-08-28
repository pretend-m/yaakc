import { cookieJarsAtom, patchModel } from '@yaakapp-internal/models';
import { useAtomValue } from 'jotai';
import { memo, useMemo } from 'react';
import { useActiveCookieJar } from '../hooks/useActiveCookieJar';
import { useCreateCookieJar } from '../hooks/useCreateCookieJar';
import { deleteModelWithConfirm } from '../lib/deleteModelWithConfirm';
import { showDialog } from '../lib/dialog';
import { showPrompt } from '../lib/prompt';
import { setWorkspaceSearchParams } from '../lib/setWorkspaceSearchParams';
import { CookieDialog } from './CookieDialog';
import { Dropdown, type DropdownItem } from './core/Dropdown';
import { Icon } from './core/Icon';
import { IconButton } from './core/IconButton';
import { InlineCode } from './core/InlineCode';

export const CookieDropdown = memo(function CookieDropdown() {
  const activeCookieJar = useActiveCookieJar();
  const createCookieJar = useCreateCookieJar();
  const cookieJars = useAtomValue(cookieJarsAtom);

  const items = useMemo((): DropdownItem[] => {
    return [
      ...(cookieJars ?? []).map((j) => ({
        key: j.id,
        label: "默认",
        leftSlot: <Icon icon={j.id === activeCookieJar?.id ? 'check' : 'empty'} />,
        onSelect: () => {
          setWorkspaceSearchParams({ cookie_jar_id: j.id });
        },
      })),
      ...(((cookieJars ?? []).length > 0 && activeCookieJar != null
        ? [
            { type: 'separator', label: "默认" },
            {
              key: 'manage',
              label: '管理Cookies',
              leftSlot: <Icon icon="cookie" />,
              onSelect: () => {
                if (activeCookieJar == null) return;
                showDialog({
                  id: 'cookies',
                  title: '管理Cookies',
                  size: 'full',
                  render: () => <CookieDialog cookieJarId={activeCookieJar.id} />,
                });
              },
            },
            {
              key: 'rename',
              label: '重命名',
              leftSlot: <Icon icon="pencil" />,
              onSelect: async () => {
                const name = await showPrompt({
                  id: 'rename-cookie-jar',
                  title: '重命名Cookie Jar',
                  description: (
                    <>
                      输入新名称
                    </>
                  ),
                  label: '名称',
                  confirmText: '保存',
                  cancelText: '取消',
                  placeholder: '新名称',
                  defaultValue: '新名称',
                });
                if (name == null) return;
                await patchModel(activeCookieJar, { name });
              },
            },
            ...(((cookieJars ?? []).length > 1 // Never delete the last one
              ? [
                  {
                    label: '删除',
                    leftSlot: <Icon icon="trash" />,
                    color: 'danger',
                    onSelect: async () => {
                      await deleteModelWithConfirm(activeCookieJar);
                    },
                  },
                ]
              : []) as DropdownItem[]),
          ]
        : []) as DropdownItem[]),
      { type: 'separator' },
      {
        key: 'create-cookie-jar',
        label: '新建Cookie Jar',
        leftSlot: <Icon icon="plus" />,
        onSelect: () => createCookieJar.mutate(),
      },
    ];
  }, [activeCookieJar, cookieJars, createCookieJar]);

  return (
    <Dropdown items={items}>
      <IconButton size="sm" icon="cookie" iconColor="secondary" title="Cookie Jar" />
    </Dropdown>
  );
});
