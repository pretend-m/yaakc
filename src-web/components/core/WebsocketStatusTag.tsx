import type { WebsocketConnection } from '@yaakapp-internal/models';
import classNames from 'classnames';

interface Props {
  connection: WebsocketConnection;
  className?: string;
}

export function WebsocketStatusTag({ connection, className }: Props) {
  const { state, error } = connection;

  let label;
  let colorClass = 'text-text-subtle';

  if (error) {
    label = '异常';
    colorClass = 'text-danger';
  } else if (state === 'connected') {
    label = '已连接';
    colorClass = 'text-success';
  } else if (state === 'closing') {
    label = '关闭';
  } else if (state === 'closed') {
    label = '关闭';
    colorClass = 'text-warning';
  } else {
    label = '连接';
  }

  return <span className={classNames(className, 'font-mono', colorClass)}>{label}</span>;
}
