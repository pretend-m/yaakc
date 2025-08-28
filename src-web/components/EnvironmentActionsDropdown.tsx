import classNames from 'classnames';
import { memo, useCallback, useMemo } from 'react';
import { useActiveEnvironment } from '../hooks/useActiveEnvironment';
import { useEnvironmentsBreakdown } from '../hooks/useEnvironmentsBreakdown';
import { toggleDialog } from '../lib/dialog';
import { setWorkspaceSearchParams } from '../lib/setWorkspaceSearchParams';
import { Button } from './core/Button';
import type { ButtonProps } from './core/Button';
import type { DropdownItem } from './core/Dropdown';
import { Dropdown } from './core/Dropdown';
import { Icon } from './core/Icon';
import { EnvironmentColorIndicator } from './EnvironmentColorIndicator';
import { EnvironmentEditDialog } from './EnvironmentEditDialog';

type Props = {
  className?: string;
} & Pick<ButtonProps, 'forDropdown' | 'leftSlot'>;

export const EnvironmentActionsDropdown = memo(function EnvironmentActionsDropdown({
  className,
  ...buttonProps
}: Props) {
  const { subEnvironments, baseEnvironment } = useEnvironmentsBreakdown();
  const activeEnvironment = useActiveEnvironment();

  const showEnvironmentDialog = useCallback(() => {
    toggleDialog({
      id: 'environment-editor',
      noPadding: true,
      size: 'lg',
      className: 'h-[80vh]',
      render: () => <EnvironmentEditDialog initialEnvironment={activeEnvironment} />,
    });
  }, [activeEnvironment]);

  const items: DropdownItem[] = useMemo(
    () => [
      ...subEnvironments.map(
        (e) => ({
          key: e.id,
          label: e.name,
          rightSlot: <EnvironmentColorIndicator environment={e} />,
          leftSlot: e.id === activeEnvironment?.id ? <Icon icon="check" /> : <Icon icon="empty" />,
          onSelect: async () => {
            if (e.id !== activeEnvironment?.id) {
              setWorkspaceSearchParams({ environment_id: e.id });
            } else {
              setWorkspaceSearchParams({ environment_id: null });
            }
          },
        }),
        [activeEnvironment?.id],
      ),
      ...((subEnvironments.length > 0
        ? [{ type: 'separator', label: '环境' }]
        : []) as DropdownItem[]),
      {
        key: 'edit',
        label: '管理环境',
        hotKeyAction: 'environmentEditor.toggle',
        leftSlot: <Icon icon="box" />,
        onSelect: showEnvironmentDialog,
      },
    ],
    [activeEnvironment?.id, subEnvironments, showEnvironmentDialog],
  );

  const hasBaseVars =
    (baseEnvironment?.variables ?? []).filter((v) => v.enabled && (v.name || v.value)).length > 0;

  return (
    <Dropdown items={items}>
      <Button
        size="sm"
        className={classNames(
          className,
          'text !px-2 truncate',
          !activeEnvironment && !hasBaseVars && 'text-text-subtlest italic',
        )}
        // If no environments, the button simply opens the dialog.
        // NOTE: We don't create a new button because we want to reuse the hotkey from the menu items
        onClick={subEnvironments.length === 0 ? showEnvironmentDialog : undefined}
        {...buttonProps}
      >
        <EnvironmentColorIndicator environment={activeEnvironment ?? null} />
        {activeEnvironment?.name ?? (hasBaseVars ? '环境' : '无环境')}
      </Button>
    </Dropdown>
  );
});
