import type { PluginDefinition } from '@yaakapp/api';

export const plugin: PluginDefinition = {
  authentication: {
    name: 'apikey',
    label: 'API密钥',
    shortLabel: 'API密钥',
    args: [
      {
        type: 'select',
        name: 'location',
        label: '行为',
        defaultValue: 'header',
        options: [
          { label: '请求头', value: 'header' },
          { label: '查询参数', value: 'query' },
        ],
      },
      {
        type: 'text',
        name: 'key',
        label: '密钥',
        dynamic: (_ctx, { values }) => {
          return values.location === 'query' ? {
            label: '参数名称',
            description: '要添加到请求中的查询参数名称',
          } : {
            label: '请求头名称',
            description: '要添加到请求头中的名称',
          };
        },
      },
      {
        type: 'text',
        name: 'value',
        label: 'API密钥',
        optional: true,
        password: true,
      },
    ],
    async onApply(_ctx, { values }) {
      const key = String(values.key ?? '');
      const value = String(values.value ?? '');
      const location = String(values.location);

      if (location === 'query') {
        return { setQueryParameters: [{ name: key, value }] };
      } else {
        return { setHeaders: [{ name: key, value }] };
      }
    },
  },
};
