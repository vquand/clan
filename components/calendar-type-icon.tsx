import { Moon, Sun } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export type CalendarType = 'solar' | 'lunar';

type CalendarTypeIconProps = ComponentProps<typeof Sun> & {
  calendar: CalendarType;
};

export function CalendarTypeIcon({
  calendar,
  className,
  ...props
}: CalendarTypeIconProps) {
  const Icon = calendar === 'lunar' ? Moon : Sun;
  return (
    <Icon
      {...props}
      className={cn('calendar-type-icon', className)}
      data-calendar-icon={calendar}
      fill="currentColor"
      strokeWidth={2.75}
    />
  );
}
