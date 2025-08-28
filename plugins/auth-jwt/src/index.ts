import type { PluginDefinition } from '@yaakapp/api';
import jwt from 'jsonwebtoken';

const algorithms = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'none',
] as const;

const defaultAlgorithm = algorithms[0];

export const plugin: PluginDefinition = {
  authentication: {
    name: 'jwt',
    label: 'JWT',
    shortLabel: 'JWT',
    args: [
      {
        type: 'select',
        name: 'algorithm',
        label: '算法',
        hideLabel: true,
        defaultValue: defaultAlgorithm,
        options: algorithms.map((value) => ({ label: value === 'none' ? 'None' : value, value })),
      },
      {
        type: 'text',
        name: 'secret',
        label: '密钥或私钥',
        password: true,
        optional: true,
        multiLine: true,
      },
      {
        type: 'checkbox',
        name: 'secretBase64',
        label: '密钥为base64编码',
      },
      {
        type: 'editor',
        name: 'payload',
        label: '载荷',
        language: 'json',
        defaultValue: '{\n  "foo": "bar"\n}',
        placeholder: '{ }',
      },
    ],
    async onApply(_ctx, { values }) {
      const { algorithm, secret: _secret, secretBase64, payload } = values;
      const secret = secretBase64 ? Buffer.from(`${_secret}`, 'base64') : `${_secret}`;
      const token = jwt.sign(`${payload}`, secret, {
        algorithm: algorithm as (typeof algorithms)[number],
      });
      const value = `Bearer ${token}`;
      return { setHeaders: [{ name: 'Authorization', value }] };
    },
  },
};
