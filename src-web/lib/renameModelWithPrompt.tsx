import type { AnyModel} from '@yaakapp-internal/models';
import { patchModel } from '@yaakapp-internal/models';
import { InlineCode } from '../components/core/InlineCode';
import { showPrompt } from './prompt';

export async function renameModelWithPrompt(model: Extract<AnyModel, { name: string }> | null) {
  if (model == null) {
    throw new Error('Tried to rename null model');
  }

  const name = await showPrompt({
    id: 'rename-request',
    title: '重命名请求',
    description:
      model.name === '' ? (
        '输入新名称'
      ) : (
        <>
          请输入 <InlineCode>{model.name}</InlineCode> 的新名称
        </>
      ),
    label: '名称',
    placeholder: '新名称',
    defaultValue: model.name,
    confirmText: '保存',
    cancelText: '取消',
  });

  if (name == null) return;

  await patchModel(model, { name });
}
