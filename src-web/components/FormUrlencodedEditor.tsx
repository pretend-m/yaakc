import type { HttpRequest } from '@yaakapp-internal/models';
import { useCallback, useMemo } from 'react';
import type { Pair, PairEditorProps } from './core/PairEditor';
import { PairOrBulkEditor } from './core/PairOrBulkEditor';

type Props = {
  forceUpdateKey: string;
  request: HttpRequest;
  onChange: (headers: HttpRequest['body']) => void;
};

export function FormUrlencodedEditor({ request, forceUpdateKey, onChange }: Props) {
  const pairs = useMemo<Pair[]>(
    () =>
      (Array.isArray(request.body.form) ? request.body.form : []).map((p) => ({
        enabled: !!p.enabled,
        name: p.name || '',
        value: p.value || '',
        id: p.id,
      })),
    [request.body.form],
  );
  console.log(pairs)

  const handleChange = useCallback<PairEditorProps['onChange']>(
    (pairs) =>
      onChange({ form: pairs.map((p) => ({ enabled: p.enabled, name: p.name, value: p.value })) }),
    [onChange],
  );

  return (
    <PairOrBulkEditor
      allowMultilineValues
      preferenceName="form_urlencoded"
      valueAutocompleteFunctions
      valueAutocompleteVariables
      nameAutocompleteFunctions
      nameAutocompleteVariables
      namePlaceholder="名称"
      valuePlaceholder="值"
      pairs={pairs}
      onChange={handleChange}
      forceUpdateKey={forceUpdateKey}
      stateKey={`urlencoded.${request.id}`}
    />
  );
}
