import type { Environment } from '@yaakapp-internal/models';
import { duplicateModel, patchModel } from '@yaakapp-internal/models';
import type { GenericCompletionOption } from '@yaakapp-internal/plugins';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { createEnvironmentAndActivate } from '../commands/createEnvironment';
import { useEnvironmentsBreakdown } from '../hooks/useEnvironmentsBreakdown';
import { useIsEncryptionEnabled } from '../hooks/useIsEncryptionEnabled';
import { useKeyValue } from '../hooks/useKeyValue';
import { useRandomKey } from '../hooks/useRandomKey';
import { deleteModelWithConfirm } from '../lib/deleteModelWithConfirm';
import { analyzeTemplate, convertTemplateToSecure } from '../lib/encryption';
import { showPrompt } from '../lib/prompt';
import { resolvedModelName } from '../lib/resolvedModelName';
import {
  setupOrConfigureEncryption,
  withEncryptionEnabled,
} from '../lib/setupOrConfigureEncryption';
import { showColorPicker } from '../lib/showColorPicker';
import { BadgeButton } from './core/BadgeButton';
import { Banner } from './core/Banner';
import { Button } from './core/Button';
import { DismissibleBanner } from './core/DismissibleBanner';
import type { DropdownItem } from './core/Dropdown';
import { ContextMenu } from './core/Dropdown';
import type { GenericCompletionConfig } from './core/Editor/genericCompletion';
import { Heading } from './core/Heading';
import { Icon } from './core/Icon';
import { IconButton } from './core/IconButton';
import { IconTooltip } from './core/IconTooltip';
import { InlineCode } from './core/InlineCode';
import type { PairWithId } from './core/PairEditor';
import { ensurePairId } from './core/PairEditor';
import { PairOrBulkEditor } from './core/PairOrBulkEditor';
import { Separator } from './core/Separator';
import { SplitLayout } from './core/SplitLayout';
import { VStack } from './core/Stacks';
import { EnvironmentColorIndicator } from './EnvironmentColorIndicator';

interface Props {
  initialEnvironment: Environment | null;
}

export const EnvironmentEditDialog = function ({ initialEnvironment }: Props) {
  const { baseEnvironment, otherBaseEnvironments, subEnvironments, allEnvironments } =
    useEnvironmentsBreakdown();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(
    initialEnvironment?.id ?? null,
  );

  const selectedEnvironment =
    selectedEnvironmentId != null
      ? allEnvironments.find((e) => e.id === selectedEnvironmentId)
      : baseEnvironment;

  const handleCreateEnvironment = async () => {
    if (baseEnvironment == null) return;
    const id = await createEnvironmentAndActivate.mutateAsync(baseEnvironment);
    if (id != null) setSelectedEnvironmentId(id);
  };

  const handleDuplicateEnvironment = useCallback(async (environment: Environment) => {
    const name = await showPrompt({
      id: 'duplicate-environment',
      title: '复制环境',
      label: '名称',
      defaultValue: environment.name,
    });
    if (name) {
      const newId = await duplicateModel({ ...environment, name, public: false });
      setSelectedEnvironmentId(newId);
    }
  }, []);

  const handleDeleteEnvironment = useCallback(
    async (environment: Environment) => {
      await deleteModelWithConfirm(environment);
      if (selectedEnvironmentId === environment.id) {
        setSelectedEnvironmentId(baseEnvironment?.id ?? null);
      }
    },
    [baseEnvironment?.id, selectedEnvironmentId],
  );

  if (baseEnvironment == null) {
    return null;
  }

  return (
    <SplitLayout
      name="env_editor"
      defaultRatio={0.75}
      layout="horizontal"
      className="gap-0"
      firstSlot={() => (
        <aside className="w-full min-w-0 pt-2">
          <div className="min-w-0 h-full overflow-y-auto pt-1">
            {[baseEnvironment, ...otherBaseEnvironments].map((e) => (
              <SidebarButton
                key={e.id}
                active={selectedEnvironment?.id == e.id}
                onClick={() => setSelectedEnvironmentId(e.id)}
                environment={e}
                duplicateEnvironment={handleDuplicateEnvironment}
                // Allow deleting base environment if there are multiples
                deleteEnvironment={
                  otherBaseEnvironments.length > 0 ? handleDeleteEnvironment : null
                }
                rightSlot={e.public && sharableTooltip}
                outerRightSlot={
                  <IconButton
                    size="sm"
                    iconSize="md"
                    title="Add sub environment"
                    icon="plus_circle"
                    iconClassName="text-text-subtlest group-hover:text-text-subtle"
                    className="group mr-0.5"
                    onClick={handleCreateEnvironment}
                  />
                }
              >
                {resolvedModelName(e)}
              </SidebarButton>
            ))}
            {subEnvironments.length > 0 && (
              <div className="px-2">
                <Separator className="my-3" />
              </div>
            )}
            {subEnvironments.map((e) => (
              <SidebarButton
                key={e.id}
                active={selectedEnvironment?.id === e.id}
                environment={e}
                onClick={() => setSelectedEnvironmentId(e.id)}
                rightSlot={e.public && sharableTooltip}
                duplicateEnvironment={handleDuplicateEnvironment}
                deleteEnvironment={handleDeleteEnvironment}
              >
                {e.name}
              </SidebarButton>
            ))}
          </div>
        </aside>
      )}
      secondSlot={() =>
        selectedEnvironment == null ? (
          <div className="p-3 mt-10">
            <Banner color="danger">
              Failed to find selected environment <InlineCode>{selectedEnvironmentId}</InlineCode>
            </Banner>
          </div>
        ) : (
          <EnvironmentEditor
            className="pt-2 border-l border-border-subtle"
            environment={selectedEnvironment}
          />
        )
      }
    />
  );
};

const EnvironmentEditor = function ({
  environment: selectedEnvironment,
  className,
}: {
  environment: Environment;
  className?: string;
}) {
  const workspaceId = selectedEnvironment.workspaceId;
  const isEncryptionEnabled = useIsEncryptionEnabled();
  const valueVisibility = useKeyValue<boolean>({
    namespace: 'global',
    key: ['environmentValueVisibility', workspaceId],
    fallback: false,
  });
  const { allEnvironments } = useEnvironmentsBreakdown();
  const handleChange = useCallback(
    (variables: PairWithId[]) => patchModel(selectedEnvironment, { variables }),
    [selectedEnvironment],
  );
  const [forceUpdateKey, regenerateForceUpdateKey] = useRandomKey();

  // Gather a list of env names from other environments to help the user get them aligned
  const nameAutocomplete = useMemo<GenericCompletionConfig>(() => {
    const options: GenericCompletionOption[] = [];
    if (selectedEnvironment.base) {
      return { options };
    }

    const allVariables = allEnvironments.flatMap((e) => e?.variables);
    const allVariableNames = new Set(allVariables.map((v) => v?.name));
    for (const name of allVariableNames) {
      const containingEnvs = allEnvironments.filter((e) =>
        e.variables.some((v) => v.name === name),
      );
      const isAlreadyInActive = containingEnvs.find((e) => e.id === selectedEnvironment.id);
      if (isAlreadyInActive) continue;
      options.push({
        label: name,
        type: 'constant',
        detail: containingEnvs.map((e) => e.name).join(', '),
      });
    }
    return { options };
  }, [selectedEnvironment.base, selectedEnvironment.id, allEnvironments]);

  const validateName = useCallback((name: string) => {
    // Empty just means the variable doesn't have a name yet and is unusable
    if (name === '') return true;
    return name.match(/^[a-z_][a-z0-9_-]*$/i) != null;
  }, []);

  const valueType = !isEncryptionEnabled && valueVisibility.value ? 'text' : 'password';
  const promptToEncrypt = useMemo(() => {
    if (!isEncryptionEnabled) {
      return true;
    } else {
      return !selectedEnvironment.variables.every(
        (v) => v.value === '' || analyzeTemplate(v.value) !== 'insecure',
      );
    }
  }, [selectedEnvironment.variables, isEncryptionEnabled]);

  const encryptEnvironment = (environment: Environment) => {
    withEncryptionEnabled(async () => {
      const encryptedVariables: PairWithId[] = [];
      for (const variable of environment.variables) {
        const value = variable.value ? await convertTemplateToSecure(variable.value) : '';
        encryptedVariables.push(ensurePairId({ ...variable, value }));
      }
      await handleChange(encryptedVariables);
      regenerateForceUpdateKey();
    });
  };

  return (
    <VStack space={4} className={classNames(className, 'pl-4')}>
      <Heading className="w-full flex items-center gap-0.5">
        <EnvironmentColorIndicator clickToEdit environment={selectedEnvironment ?? null} />
        <div className="mr-2">{selectedEnvironment?.name}</div>
        {isEncryptionEnabled ? (
          promptToEncrypt ? (
            <BadgeButton color="notice" onClick={() => encryptEnvironment(selectedEnvironment)}>
              加密所有变量
            </BadgeButton>
          ) : (
            <BadgeButton color="secondary" onClick={setupOrConfigureEncryption}>
              加密设置
            </BadgeButton>
          )
        ) : (
          <>
            <BadgeButton color="secondary" onClick={() => valueVisibility.set((v) => !v)}>
              {valueVisibility.value ? '隐藏值' : '显示值'}
            </BadgeButton>
          </>
        )}
      </Heading>
      {selectedEnvironment.public && promptToEncrypt && (
        <DismissibleBanner
          id={`warn-unencrypted-${selectedEnvironment.id}`}
          color="notice"
          className="mr-3"
        >
          该环境为可共享环境。请加密变量值，以防在目录同步或数据导出时意外泄露敏感信息
        </DismissibleBanner>
      )}
      <div className="h-full pr-2 pb-2 grid grid-rows-[minmax(0,1fr)] overflow-auto">
        <PairOrBulkEditor
          allowMultilineValues
          preferenceName="environment"
          nameAutocomplete={nameAutocomplete}
          namePlaceholder="名称"
          valuePlaceholder="值"
          nameValidate={validateName}
          valueType={valueType}
          valueAutocompleteVariables
          valueAutocompleteFunctions
          forceUpdateKey={`${selectedEnvironment.id}::${forceUpdateKey}`}
          pairs={selectedEnvironment.variables}
          onChange={handleChange}
          stateKey={`environment.${selectedEnvironment.id}`}
          forcedEnvironmentId={
            // Editing the base environment should resolve variables using the active environment.
            // Editing a sub environment should resolve variables as if it's the active environment
            selectedEnvironment.base ? undefined : selectedEnvironment.id
          }
        />
      </div>
    </VStack>
  );
};

function SidebarButton({
  children,
  className,
  active,
  onClick,
  deleteEnvironment,
  rightSlot,
  outerRightSlot,
  duplicateEnvironment,
  environment,
}: {
  className?: string;
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  rightSlot?: ReactNode;
  outerRightSlot?: ReactNode;
  environment: Environment;
  deleteEnvironment: ((environment: Environment) => void) | null;
  duplicateEnvironment: ((environment: Environment) => void) | null;
}) {
  const [showContextMenu, setShowContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      <div
        className={classNames(
          className,
          'w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-0.5',
          'px-2', // Padding to show the focus border
        )}
      >
        <Button
          color="custom"
          size="xs"
          className={classNames(
            'w-full',
            active ? 'text bg-surface-active' : 'text-text-subtle hover:text',
          )}
          justify="start"
          onClick={onClick}
          onContextMenu={handleContextMenu}
          rightSlot={rightSlot}
        >
          <EnvironmentColorIndicator environment={environment} />
          {children}
        </Button>
        {outerRightSlot}
      </div>
      <ContextMenu
        triggerPosition={showContextMenu}
        onClose={() => setShowContextMenu(null)}
        items={[
          {
            label: '重命名',
            leftSlot: <Icon icon="pencil" />,
            hidden: environment.base,
            onSelect: async () => {
              const name = await showPrompt({
                id: 'rename-environment',
                title: '重命名环境',
                description: (
                  <>
                    Enter a new name for <InlineCode>{environment.name}</InlineCode>
                  </>
                ),
                label: '名称',
                confirmText: '保存',
                placeholder: '新名称',
                defaultValue: environment.name,
              });
              if (name == null) return;
              await patchModel(environment, { name });
            },
          },
          ...((duplicateEnvironment
            ? [
                {
                  label: '复制',
                  leftSlot: <Icon icon="copy" />,
                  onSelect: () => {
                    duplicateEnvironment?.(environment);
                  },
                },
              ]
            : []) as DropdownItem[]),
          {
            label: environment.color ? 'Change Color' : 'Assign Color',
            leftSlot: <Icon icon="palette" />,
            hidden: environment.base,
            onSelect: async () => showColorPicker(environment),
          },
          {
            label: `设为${environment.public ? '私有' : '可分享'}`,
            leftSlot: <Icon icon={environment.public ? 'eye_closed' : 'eye'} />,
            rightSlot: (
              <IconTooltip
                content={
                  <>
                    可共享环境将被包含在目录同步或数据导出中。建议对可共享环境中的所有变量值进行加密，以防止意外泄露敏感信息
                  </>
                }
              />
            ),
            onSelect: async () => {
              await patchModel(environment, { public: !environment.public });
            },
          },
          ...((deleteEnvironment
            ? [
                {
                  color: 'danger',
                  label: '删除',
                  leftSlot: <Icon icon="trash" />,
                  onSelect: () => {
                    deleteEnvironment(environment);
                  },
                },
              ]
            : []) as DropdownItem[]),
        ]}
      />
    </>
  );
}

const sharableTooltip = (
  <IconTooltip
    icon="eye"
    content="此环境会参与目录同步及数据导出"
  />
);
