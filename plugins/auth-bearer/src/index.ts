import type { CallHttpAuthenticationRequest } from '@yaakapp-internal/plugins';
import type { PluginDefinition } from '@yaakapp/api';

export const plugin: PluginDefinition = {
  authentication: {
    name: 'bearer',
    label: 'Bearer Token',
    shortLabel: 'Bearer Token',
    args: [
      {
        type: 'text',
        name: 'token',
        label: 'Token',
        optional: true,
        password: true,
      },
      {
        type: 'text',
        name: 'prefix',
        label: '前缀',
        optional: true,
        placeholder: '',
        defaultValue: 'Bearer',
        description:
          '用于Authorization头部的前缀,格式为 "<PREFIX> <TOKEN>".',
      },
    ],
    async onApply(_ctx, { values }) {
      return { setHeaders: [generateAuthorizationHeader(values)] };
    },
  },
};

function generateAuthorizationHeader(values: CallHttpAuthenticationRequest['values']) {
  const token = String(values.token || '').trim();
  const prefix = String(values.prefix || '').trim();
  const value = `${prefix} ${token}`.trim();
  return { name: 'Authorization', value };
}
