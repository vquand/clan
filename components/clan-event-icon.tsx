import type { ComponentProps } from 'react';

import { CalendarTypeIcon } from '@/components/calendar-type-icon';
import type { ClanEvent } from '@/data/types';
import { cn } from '@/lib/utils';

type EventIconName =
  | 'tet'
  | 'nguyen-tieu'
  | 'han-thuc'
  | 'doan-ngo'
  | 'vu-lan'
  | 'trung-thu'
  | 'tao-quan';

type ClanEventIconProps = ComponentProps<'svg'> & {
  event: Pick<ClanEvent, 'id' | 'title' | 'calendar'>;
};

function normalizeEventLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

function getEventIconName(
  event: Pick<ClanEvent, 'id' | 'title' | 'calendar'>,
): EventIconName | null {
  if (event.calendar !== 'lunar') return null;

  const label = normalizeEventLabel(`${event.id} ${event.title}`);
  if (
    label.includes('ong cong') ||
    label.includes('ong tao') ||
    label.includes('tao quan')
  ) {
    return 'tao-quan';
  }
  if (label.includes('trung thu')) return 'trung-thu';
  if (label.includes('nguyen tieu')) return 'nguyen-tieu';
  if (label.includes('han thuc')) return 'han-thuc';
  if (label.includes('doan ngo')) return 'doan-ngo';
  if (label.includes('vu lan')) return 'vu-lan';
  if (label.includes('tet nguyen dan') || label.includes('tet')) return 'tet';
  return null;
}

type IconArtworkProps = {
  name: EventIconName;
};

function IconArtwork({ name }: IconArtworkProps) {
  if (name === 'tet') {
    return (
      <>
        <path d="m5.5 8 6.5-3.2L18.5 8 12 11.2 5.5 8Z" fill="currentColor" />
        <path d="M5.5 8v8.8L12 20l6.5-3.2V8M12 11.2V20" />
      </>
    );
  }

  if (name === 'tao-quan') {
    return (
      <>
        <g transform="rotate(-25 12 12)">
          <path
            d="M4.25 12c2.5-4 8-4.35 13.55 0-5.55 4.35-11.05 4-13.55 0Z"
            fill="currentColor"
          />
          <path d="m4.25 12-2.15-2.1v4.2L4.25 12ZM14.5 10.2v3.6" />
        </g>
        <path d="M7.2 5.25 8 3.5M11.5 5 12 3M15.65 6.05l1.25-1.35" />
      </>
    );
  }

  if (name === 'trung-thu') {
    return <circle cx="12" cy="12" r="6.7" fill="currentColor" />;
  }

  if (name === 'nguyen-tieu') {
    return (
      <>
        <path d="M8 8.25h8l1.1 2.1v6.4H6.9v-6.4L8 8.25Z" fill="currentColor" />
        <path d="M12 4.2v4.05M9.2 6.15h5.6M9.1 16.75h5.8M12 16.75v3.05" />
      </>
    );
  }

  if (name === 'han-thuc') {
    return (
      <>
        <path d="M5.5 16.9h13" />
        <circle cx="8" cy="12.7" r="2.25" fill="currentColor" />
        <circle cx="12" cy="11.1" r="2.25" fill="currentColor" />
        <circle cx="16" cy="12.7" r="2.25" fill="currentColor" />
        <path d="M6.5 17.2h11" />
      </>
    );
  }

  if (name === 'doan-ngo') {
    return (
      <>
        <path
          d="M6.1 18.3c.2-5.8 3.4-9.65 10.85-11.05-.35 7.35-4.15 10.8-10.85 11.05Z"
          fill="currentColor"
        />
        <path d="M6.1 18.3c.2-5.8 3.4-9.65 10.85-11.05-.35 7.35-4.15 10.8-10.85 11.05ZM6.35 18.15l8.4-8.35" />
        <path d="M5 20.3c2.5-1.2 4.2-2.95 5.25-5.25" />
      </>
    );
  }

  return (
    <>
      <path
        d="M12 20.15c-1.55-2.2-6.55-4.25-6.55-8.5 0-2.1 1.55-3.65 3.45-3.65 1.35 0 2.45.75 3.1 1.75.65-1 1.75-1.75 3.1-1.75 1.9 0 3.45 1.55 3.45 3.65 0 4.25-5 6.3-6.55 8.5Z"
        fill="currentColor"
      />
      <path d="M12 20.15c-1.55-2.2-6.55-4.25-6.55-8.5 0-2.1 1.55-3.65 3.45-3.65 1.35 0 2.45.75 3.1 1.75.65-1 1.75-1.75 3.1-1.75 1.9 0 3.45 1.55 3.45 3.65 0 4.25-5 6.3-6.55 8.5Z" />
    </>
  );
}

export function ClanEventIcon({
  event,
  className,
  ...props
}: ClanEventIconProps) {
  const name = getEventIconName(event);
  const iconClassName = cn('event-icon', className);

  if (!name) {
    return (
      <CalendarTypeIcon
        {...props}
        calendar={event.calendar}
        className={iconClassName}
      />
    );
  }

  return (
    <svg
      {...props}
      className={iconClassName}
      data-calendar-icon={event.calendar}
      data-event-icon={name}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <IconArtwork name={name} />
    </svg>
  );
}
