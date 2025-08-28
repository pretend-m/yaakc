import type { AnyModel } from '@yaakapp-internal/models';
import { deleteModel, modelTypeLabel } from '@yaakapp-internal/models';
import { InlineCode } from '../components/core/InlineCode';
import { showConfirmDelete } from './confirm';
import { resolvedModelName } from './resolvedModelName';

export async function deleteModelWithConfirm(
  model: AnyModel | null,
  options: { confirmName?: string } = {},
): Promise<boolean> {
  if (model == null) {
    console.warn('Tried to delete null model');
    return false;
  }

  const confirmed = await showConfirmDelete({
    id: 'delete-model-' + model.id,
    title: '删除工作区',
    requireTyping: options.confirmName,
    description: (
      <>
        永久删除 <InlineCode>{resolvedModelName(model)}</InlineCode>?
      </>
    ),
  });

  if (!confirmed) {
    return false;
  }

  await deleteModel(model);
  return true;
}
