import type {
  Context,
  FormInputSelectOption,
  GetHttpAuthenticationConfigRequest,
  JsonPrimitive,
  PluginDefinition,
} from '@yaakapp/api';
import {
  genPkceCodeVerifier,
  DEFAULT_PKCE_METHOD,
  getAuthorizationCode,
  PKCE_PLAIN,
  PKCE_SHA256,
} from './grants/authorizationCode';
import { getClientCredentials } from './grants/clientCredentials';
import { getImplicit } from './grants/implicit';
import { getPassword } from './grants/password';
import type { AccessToken, TokenStoreArgs } from './store';
import { deleteToken, getToken, resetDataDirKey } from './store';

type GrantType = 'authorization_code' | 'implicit' | 'password' | 'client_credentials';

const grantTypes: FormInputSelectOption[] = [
  { label: 'Authorization Code', value: 'authorization_code' },
  { label: '隐式', value: 'implicit' },
  { label: '资源所有者密码凭证', value: 'password' },
  { label: '客户端凭证', value: 'client_credentials' },
];

const defaultGrantType = grantTypes[0]!.value;

function hiddenIfNot(
  grantTypes: GrantType[],
  ...other: ((values: GetHttpAuthenticationConfigRequest['values']) => boolean)[]
) {
  return (_ctx: Context, { values }: GetHttpAuthenticationConfigRequest) => {
    const hasGrantType = grantTypes.find((t) => t === String(values.grantType ?? defaultGrantType));
    const hasOtherBools = other.every((t) => t(values));
    const show = hasGrantType && hasOtherBools;
    return { hidden: !show };
  };
}

const authorizationUrls = [
  'https://github.com/login/oauth/authorize',
  'https://account.box.com/api/oauth2/authorize',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://api.imgur.com/oauth2/authorize',
  'https://bitly.com/oauth/authorize',
  'https://gitlab.example.com/oauth/authorize',
  'https://medium.com/m/oauth/authorize',
  'https://public-api.wordpress.com/oauth2/authorize',
  'https://slack.com/oauth/authorize',
  'https://todoist.com/oauth/authorize',
  'https://www.dropbox.com/oauth2/authorize',
  'https://www.linkedin.com/oauth/v2/authorization',
  'https://MY_SHOP.myshopify.com/admin/oauth/access_token',
  'https://appcenter.intuit.com/app/connect/oauth2/authorize',
];

const accessTokenUrls = [
  'https://github.com/login/oauth/access_token',
  'https://api-ssl.bitly.com/oauth/access_token',
  'https://api.box.com/oauth2/token',
  'https://api.dropboxapi.com/oauth2/token',
  'https://api.imgur.com/oauth2/token',
  'https://api.medium.com/v1/tokens',
  'https://gitlab.example.com/oauth/token',
  'https://public-api.wordpress.com/oauth2/token',
  'https://slack.com/api/oauth.access',
  'https://todoist.com/oauth/access_token',
  'https://www.googleapis.com/oauth2/v4/token',
  'https://www.linkedin.com/oauth/v2/accessToken',
  'https://MY_SHOP.myshopify.com/admin/oauth/authorize',
  'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
];

export const plugin: PluginDefinition = {
  authentication: {
    name: 'oauth2',
    label: 'OAuth2.0',
    shortLabel: 'OAuth2.0',
    actions: [
      {
        label: '复制当前Token',
        async onSelect(ctx, { contextId, values }) {
          const tokenArgs: TokenStoreArgs = {
            contextId,
            authorizationUrl: stringArg(values, 'authorizationUrl'),
            accessTokenUrl: stringArg(values, 'accessTokenUrl'),
            clientId: stringArg(values, 'clientId'),
          };
          const token = await getToken(ctx, tokenArgs);
          if (token == null) {
            await ctx.toast.show({ message: '没有要复制的Token', color: 'warning' });
          } else {
            await ctx.clipboard.copyText(token.response.access_token);
            await ctx.toast.show({
              message: 'Token已复制到剪贴板',
              icon: 'copy',
              color: 'success',
            });
          }
        },
      },
      {
        label: '删除Token',
        async onSelect(ctx, { contextId, values }) {
          const tokenArgs: TokenStoreArgs = {
            contextId,
            authorizationUrl: stringArg(values, 'authorizationUrl'),
            accessTokenUrl: stringArg(values, 'accessTokenUrl'),
            clientId: stringArg(values, 'clientId'),
          };
          if (await deleteToken(ctx, tokenArgs)) {
            await ctx.toast.show({ message: 'Token已删除', color: 'success' });
          } else {
            await ctx.toast.show({ message: '没有要删除的Token', color: 'warning' });
          }
        },
      },
      {
        label: '清除会话窗口',
        async onSelect(ctx, { contextId }) {
          await resetDataDirKey(ctx, contextId);
        },
      },
      {
        label: '切换调试日志',
        async onSelect(ctx) {
          const enableLogs = !(await ctx.store.get('enable_logs'));
          await ctx.store.set('enable_logs', enableLogs);
          await ctx.toast.show({
            message: `调试日志 ${enableLogs ? 'enabled' : 'disabled'}`,
            color: 'info',
          });
        },
      },
    ],
    args: [
      {
        type: 'select',
        name: 'grantType',
        label: '授权类型',
        hideLabel: true,
        defaultValue: defaultGrantType,
        options: grantTypes,
      },

      // Always-present fields
      {
        type: 'text',
        name: 'clientId',
        label: '客户端ID',
        optional: true,
      },
      {
        type: 'text',
        name: 'clientSecret',
        label: '客户端密钥',
        optional: true,
        password: true,
        dynamic: hiddenIfNot(['authorization_code', 'password', 'client_credentials']),
      },
      {
        type: 'text',
        name: 'authorizationUrl',
        optional: true,
        label: '授权URL',
        dynamic: hiddenIfNot(['authorization_code', 'implicit']),
        placeholder: authorizationUrls[0],
        completionOptions: authorizationUrls.map((url) => ({ label: url, value: url })),
      },
      {
        type: 'text',
        name: 'accessTokenUrl',
        optional: true,
        label: '访问TokenURL',
        placeholder: accessTokenUrls[0],
        dynamic: hiddenIfNot(['authorization_code', 'password', 'client_credentials']),
        completionOptions: accessTokenUrls.map((url) => ({ label: url, value: url })),
      },
      {
        type: 'text',
        name: 'redirectUri',
        label: '重定向URI',
        optional: true,
        dynamic: hiddenIfNot(['authorization_code', 'implicit']),
      },
      {
        type: 'text',
        name: 'state',
        label: '状态',
        optional: true,
        dynamic: hiddenIfNot(['authorization_code', 'implicit']),
      },
      {
        type: 'text',
        name: 'audience',
        label: '受众',
        optional: true,
      },
      {
        type: 'select',
        name: 'tokenName',
        label: '用于授权的Token',
        description:
          '选择要在 "Authorization: Bearer" 头中发送的令牌。大多数 API 期望 access_token，但有些（如 OpenID Connect）需要 id_token',
        defaultValue: 'access_token',
        options: [
          { label: 'access_token', value: 'access_token' },
          { label: 'id_token', value: 'id_token' },
        ],
        dynamic: hiddenIfNot(['authorization_code', 'implicit']),
      },
      {
        type: 'checkbox',
        name: 'usePkce',
        label: '使用PKCE',
        dynamic: hiddenIfNot(['authorization_code']),
      },
      {
        type: 'select',
        name: 'pkceChallengeMethod',
        label: 'Code Challenge方法',
        options: [
          { label: 'SHA-256', value: PKCE_SHA256 },
          { label: '明文', value: PKCE_PLAIN },
        ],
        defaultValue: DEFAULT_PKCE_METHOD,
        dynamic: hiddenIfNot(['authorization_code'], ({ usePkce }) => !!usePkce),
      },
      {
        type: 'text',
        name: 'pkceCodeChallenge',
        label: 'Code Verifier',
        placeholder: '未设置时自动生成',
        optional: true,
        dynamic: hiddenIfNot(['authorization_code'], ({ usePkce }) => !!usePkce),
      },
      {
        type: 'text',
        name: 'username',
        label: '用户名',
        optional: true,
        dynamic: hiddenIfNot(['password']),
      },
      {
        type: 'text',
        name: 'password',
        label: '密码',
        password: true,
        optional: true,
        dynamic: hiddenIfNot(['password']),
      },
      {
        type: 'select',
        name: 'responseType',
        label: '响应类型',
        defaultValue: 'token',
        options: [
          { label: 'Access Token', value: 'token' },
          { label: 'ID Token', value: 'id_token' },
          { label: 'ID and Access Token', value: 'id_token token' },
        ],
        dynamic: hiddenIfNot(['implicit']),
      },
      {
        type: 'accordion',
        label: '高级',
        inputs: [
          { type: 'text', name: 'scope', label: '作用域', optional: true },
          {
            type: 'text',
            name: 'headerPrefix',
            label: '头部前缀',
            optional: true,
            defaultValue: 'Bearer',
          },
          {
            type: 'select',
            name: 'credentials',
            label: '发送凭证方式',
            defaultValue: 'body',
            options: [
              { label: '在请求体中', value: 'body' },
              { label: '作为基本认证', value: 'basic' },
            ],
          },
        ],
      },
      {
        type: 'accordion',
        label: '访问Token响应',
        async dynamic(ctx, { contextId, values }) {
          const tokenArgs: TokenStoreArgs = {
            contextId,
            authorizationUrl: stringArg(values, 'authorizationUrl'),
            accessTokenUrl: stringArg(values, 'accessTokenUrl'),
            clientId: stringArg(values, 'clientId'),
          };
          const token = await getToken(ctx, tokenArgs);
          if (token == null) {
            return { hidden: true };
          }
          return {
            label: '访问Token响应',
            inputs: [
              {
                type: 'editor',
                defaultValue: JSON.stringify(token.response, null, 2),
                hideLabel: true,
                readOnly: true,
                language: 'json',
              },
            ],
          };
        },
      },
    ],
    async onApply(ctx, { values, contextId }) {
      const headerPrefix = stringArg(values, 'headerPrefix');
      const grantType = stringArg(values, 'grantType') as GrantType;
      const credentialsInBody = values.credentials === 'body';
      const tokenName = values.tokenName === 'id_token' ? 'id_token' : 'access_token';

      let token: AccessToken;
      if (grantType === 'authorization_code') {
        const authorizationUrl = stringArg(values, 'authorizationUrl');
        const accessTokenUrl = stringArg(values, 'accessTokenUrl');
        token = await getAuthorizationCode(ctx, contextId, {
          accessTokenUrl:
            accessTokenUrl === '' || accessTokenUrl.match(/^https?:\/\//)
              ? accessTokenUrl
              : `https://${accessTokenUrl}`,
          authorizationUrl:
            authorizationUrl === '' || authorizationUrl.match(/^https?:\/\//)
              ? authorizationUrl
              : `https://${authorizationUrl}`,
          clientId: stringArg(values, 'clientId'),
          clientSecret: stringArg(values, 'clientSecret'),
          redirectUri: stringArgOrNull(values, 'redirectUri'),
          scope: stringArgOrNull(values, 'scope'),
          audience: stringArgOrNull(values, 'audience'),
          state: stringArgOrNull(values, 'state'),
          credentialsInBody,
          pkce: values.usePkce
            ? {
                challengeMethod: stringArg(values, 'pkceChallengeMethod') || DEFAULT_PKCE_METHOD,
                codeVerifier: stringArg(values, 'pkceCodeVerifier') || genPkceCodeVerifier(),
              }
            : null,
          tokenName: tokenName,
        });
      } else if (grantType === 'implicit') {
        const authorizationUrl = stringArg(values, 'authorizationUrl');
        token = await getImplicit(ctx, contextId, {
          authorizationUrl: authorizationUrl.match(/^https?:\/\//)
            ? authorizationUrl
            : `https://${authorizationUrl}`,
          clientId: stringArg(values, 'clientId'),
          redirectUri: stringArgOrNull(values, 'redirectUri'),
          responseType: stringArg(values, 'responseType'),
          scope: stringArgOrNull(values, 'scope'),
          audience: stringArgOrNull(values, 'audience'),
          state: stringArgOrNull(values, 'state'),
          tokenName: tokenName,
        });
      } else if (grantType === 'client_credentials') {
        const accessTokenUrl = stringArg(values, 'accessTokenUrl');
        token = await getClientCredentials(ctx, contextId, {
          accessTokenUrl: accessTokenUrl.match(/^https?:\/\//)
            ? accessTokenUrl
            : `https://${accessTokenUrl}`,
          clientId: stringArg(values, 'clientId'),
          clientSecret: stringArg(values, 'clientSecret'),
          scope: stringArgOrNull(values, 'scope'),
          audience: stringArgOrNull(values, 'audience'),
          credentialsInBody,
        });
      } else if (grantType === 'password') {
        const accessTokenUrl = stringArg(values, 'accessTokenUrl');
        token = await getPassword(ctx, contextId, {
          accessTokenUrl: accessTokenUrl.match(/^https?:\/\//)
            ? accessTokenUrl
            : `https://${accessTokenUrl}`,
          clientId: stringArg(values, 'clientId'),
          clientSecret: stringArg(values, 'clientSecret'),
          username: stringArg(values, 'username'),
          password: stringArg(values, 'password'),
          scope: stringArgOrNull(values, 'scope'),
          audience: stringArgOrNull(values, 'audience'),
          credentialsInBody,
        });
      } else {
        throw new Error('Invalid grant type ' + grantType);
      }

      const headerValue = `${headerPrefix} ${token.response[tokenName]}`.trim();
      return {
        setHeaders: [
          {
            name: 'Authorization',
            value: headerValue,
          },
        ],
      };
    },
  },
};

function stringArgOrNull(
  values: Record<string, JsonPrimitive | undefined>,
  name: string,
): string | null {
  const arg = values[name];
  if (arg == null || arg == '') return null;
  return `${arg}`;
}

function stringArg(values: Record<string, JsonPrimitive | undefined>, name: string): string {
  const arg = stringArgOrNull(values, name);
  if (!arg) return '';
  return arg;
}
