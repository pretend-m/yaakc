import type { HttpResponse } from '@yaakapp-internal/models';
import classNames from 'classnames';

interface Props {
  response: HttpResponse;
  className?: string;
  showReason?: boolean;
  short?: boolean;
}

export function HttpStatusTag({ response, className, showReason, short }: Props) {
  const { status, state } = response;

  let colorClass;
  let label = `${status}`;

  if (state === 'initialized') {
    label = short ? '已连接' : '已连接';
    colorClass = 'text-text-subtle';
  } else if (status < 100) {
    label = short ? '异常' : '异常';
    colorClass = 'text-danger';
  } else if (status < 200) {
    colorClass = 'text-info';
  } else if (status < 300) {
    colorClass = 'text-success';
  } else if (status < 400) {
    colorClass = 'text-primary';
  } else if (status < 500) {
    colorClass = 'text-warning';
  } else {
    colorClass = 'text-danger';
  }

  return (
    <span className={classNames(
      className,
      colorClass,
      /[\u4e00-\u9fa5]/.test(label) ? 'font-sans' : 'font-mono',
      'whitespace-nowrap',
      'inline-block'
    )}>
      {label} {showReason && 'statusReason' in response ? response.statusReason : null}
    </span>
  );
}
