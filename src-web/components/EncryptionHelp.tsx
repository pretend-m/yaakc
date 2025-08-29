import { VStack } from './core/Stacks';

export function EncryptionHelp() {
  return (
    <VStack space={3}>
      <p>启用加密功能后,可对密码、令牌等敏感信息进行加密处理</p>
      <p>加密数据在同步至文件系统或Git、以及导出或与他人共享时均能保持安全状态</p>
    </VStack>
  );
}
