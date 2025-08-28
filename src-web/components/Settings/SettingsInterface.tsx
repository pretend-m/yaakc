import { type } from '@tauri-apps/plugin-os';
import { useFonts } from '@yaakapp-internal/fonts';
import type { EditorKeymap } from '@yaakapp-internal/models';
import { patchModel, settingsAtom } from '@yaakapp-internal/models';
import { useAtomValue } from 'jotai';
import React from 'react';
import { activeWorkspaceAtom } from '../../hooks/useActiveWorkspace';
import { clamp } from '../../lib/clamp';
import { Checkbox } from '../core/Checkbox';
import { Icon } from '../core/Icon';
import { Select } from '../core/Select';
import { HStack, VStack } from '../core/Stacks';

const NULL_FONT_VALUE = '__NULL_FONT__';

const fontSizeOptions = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
].map((n) => ({ label: `${n}`, value: `${n}` }));

const keymaps: { value: EditorKeymap; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'vim', label: 'Vim' },
  { value: 'vscode', label: 'VSCode' },
  { value: 'emacs', label: 'Emacs' },
];

export function SettingsInterface() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const settings = useAtomValue(settingsAtom);
  const fonts = useFonts();

  if (settings == null || workspace == null) {
    return null;
  }

  return (
    <VStack space={3} className="mb-4">
      <HStack space={2} alignItems="end">
        {fonts.data && (
          <Select
            size="sm"
            name="uiFont"
            label="界面字体"
            value={settings.interfaceFont ?? NULL_FONT_VALUE}
            options={[
              { label: '系统默认', value: NULL_FONT_VALUE },
              ...(fonts.data.uiFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
              // Some people like monospace fonts for the UI
              ...(fonts.data.editorFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
            ]}
            onChange={async (v) => {
              const interfaceFont = v === NULL_FONT_VALUE ? null : v;
              await patchModel(settings, { interfaceFont });
            }}
          />
        )}
        <Select
          hideLabel
          size="sm"
          name="interfaceFontSize"
          label="界面字体大小"
          defaultValue="15"
          value={`${settings.interfaceFontSize}`}
          options={fontSizeOptions}
          onChange={(v) => patchModel(settings, { interfaceFontSize: parseInt(v) })}
        />
      </HStack>
      <HStack space={2} alignItems="end">
        {fonts.data && (
          <Select
            size="sm"
            name="editorFont"
            label="编辑器字体"
            value={settings.editorFont ?? NULL_FONT_VALUE}
            options={[
              { label: '系统默认', value: NULL_FONT_VALUE },
              ...(fonts.data.editorFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
            ]}
            onChange={async (v) => {
              const editorFont = v === NULL_FONT_VALUE ? null : v;
              await patchModel(settings, { editorFont });
            }}
          />
        )}
        <Select
          hideLabel
          size="sm"
          name="editorFontSize"
          label="编辑器字体大小"
          defaultValue="13"
          value={`${settings.editorFontSize}`}
          options={fontSizeOptions}
          onChange={(v) =>
            patchModel(settings, { editorFontSize: clamp(parseInt(v) || 14, 8, 30) })
          }
        />
      </HStack>
      <Select
        leftSlot={<Icon icon="keyboard" color="secondary" />}
        size="sm"
        name="editorKeymap"
        label="键盘映射"
        value={`${settings.editorKeymap}`}
        options={keymaps}
        onChange={(v) => patchModel(settings, { editorKeymap: v })}
      />
      <Checkbox
        checked={settings.editorSoftWrap}
        title="自动换行"
        onChange={(editorSoftWrap) => patchModel(settings, { editorSoftWrap })}
      />
      <Checkbox
        checked={settings.coloredMethods}
        title="请求方法高亮显示"
        onChange={(coloredMethods) => patchModel(settings, { coloredMethods })}
      />

      {type() !== 'macos' && (
        <Checkbox
          checked={settings.hideWindowControls}
          title="隐藏窗口控件"
          help="隐藏Windows或Linux上的关闭/最大化/最小化控件"
          onChange={(hideWindowControls) => patchModel(settings, { hideWindowControls })}
        />
      )}
    </VStack>
  );
}
