// import { openUrl } from '@tauri-apps/plugin-opener';
// import { useLicense } from '@yaakapp-internal/license';
import { useRef } from 'react';
import { openSettings } from '../commands/openSettings';
// import { useCheckForUpdates } from '../hooks/useCheckForUpdates';
import { useExportData } from '../hooks/useExportData';
// import { appInfo } from '../lib/appInfo';
import { showDialog } from '../lib/dialog';
import { importData } from '../lib/importData';
import type { DropdownRef } from './core/Dropdown';
import { Dropdown } from './core/Dropdown';
import { Icon } from './core/Icon';
import { IconButton } from './core/IconButton';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';

export function SettingsDropdown() {
  const exportData = useExportData();
  const dropdownRef = useRef<DropdownRef>(null);
  // const checkForUpdates = useCheckForUpdates();
  // const { check } = useLicense();

  return (
    <Dropdown
      ref={dropdownRef}
      items={[
        {
          label: '设置',
          hotKeyAction: 'settings.show',
          leftSlot: <Icon icon="settings" />,
          onSelect: () => openSettings.mutate(null),
        },
        {
          label: '键盘快捷键',
          hotKeyAction: 'hotkeys.showHelp',
          leftSlot: <Icon icon="keyboard" />,
          onSelect: () => {
            showDialog({
              id: 'hotkey',
              title: '键盘快捷键',
              size: 'dynamic',
              render: () => <KeyboardShortcutsDialog />,
            });
          },
        },
        {
          label: '插件',
          leftSlot: <Icon icon="puzzle" />,
          onSelect: () => openSettings.mutate('插件'),
        },
        { type: 'separator', label: '共享工作区' },
        {
          label: '导入数据',
          leftSlot: <Icon icon="folder_input" />,
          onSelect: () => importData.mutate(),
        },
        {
          label: '导出数据',
          leftSlot: <Icon icon="folder_output" />,
          onSelect: () => exportData.mutate(),
        },
        // {
        //   label: 'Create Run Button',
        //   leftSlot: <Icon icon="rocket" />,
        //   onSelect: () => openUrl('https://yaak.app/button/new'),
        // },
        // { type: 'separator', label: `Yaak v${appInfo.version}` },
        // {
        //   label: 'Purchase License',
        //   color: 'success',
        //   hidden: check.data == null || check.data.type === 'commercial_use',
        //   leftSlot: <Icon icon="circle_dollar_sign" />,
        //   onSelect: () => openSettings.mutate('license'),
        // },
        // {
        //   label: 'Check for Updates',
        //   leftSlot: <Icon icon="update" />,
        //   onSelect: () => checkForUpdates.mutate(),
        // },
        // {
        //   label: 'Feedback',
        //   leftSlot: <Icon icon="chat" />,
        //   rightSlot: <Icon icon="external_link" color="secondary" />,
        //   onSelect: () => openUrl('https://yaak.app/feedback'),
        // },
        // {
        //   label: 'Changelog',
        //   leftSlot: <Icon icon="cake" />,
        //   rightSlot: <Icon icon="external_link" color="secondary" />,
        //   onSelect: () => openUrl(`https://yaak.app/changelog/${appInfo.version}`),
        // },
      ]}
    >
      <IconButton
        size="sm"
        title="Main Menu"
        icon="settings"
        iconColor="secondary"
        className="pointer-events-auto"
      />
    </Dropdown>
  );
}
