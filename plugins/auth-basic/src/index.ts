import type { PluginDefinition } from '@yaakapp/api';

export const plugin: PluginDefinition = {
  authentication: {
    name: 'basic',
    label: '账户认证',
    shortLabel: '账户认证',
    args: [{
      type: 'text',
      name: 'username',
      label: '用户名',
      optional: true,
    }, {
      type: 'text',
      name: 'password',
      label: '密码',
      optional: true,
      password: true,
    }],
    async onApply(_ctx, { values }) {
      const { username, password } = values;
      const value = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      return { setHeaders: [{ name: 'Authorization', value }] };
    },
  },
};
