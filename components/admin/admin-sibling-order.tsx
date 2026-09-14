'use client';

import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Save } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Member } from '@/data/types';

interface AdminSiblingOrderProps {
  members: Member[];
  memberIds: string[];
  onChange: (memberIds: string[]) => void;
  onSave?: () => void;
  pending?: boolean;
  headingId?: string;
  title?: string;
  description?: string;
}

export function AdminSiblingOrder({
  members,
  memberIds,
  onChange,
  onSave,
  pending = false,
  headingId = 'member-sibling-order',
  title = 'Sibling order',
  description =
    'Oldest to youngest. This is the left-to-right order in the family tree.',
}: AdminSiblingOrderProps) {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function moveMember(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= memberIds.length) return;
    const nextMemberIds = [...memberIds];
    [nextMemberIds[index], nextMemberIds[nextIndex]] = [
      nextMemberIds[nextIndex],
      nextMemberIds[index],
    ];
    onChange(nextMemberIds);
  }

  function dropMember(index: number) {
    if (draggedIndex === null || draggedIndex === index) return;
    const nextMemberIds = [...memberIds];
    const [draggedMemberId] = nextMemberIds.splice(draggedIndex, 1);
    nextMemberIds.splice(index, 0, draggedMemberId);
    onChange(nextMemberIds);
  }

  return (
    <section
      className="admin-sibling-order"
      aria-labelledby={headingId}
    >
      <div className="admin-sibling-order-heading">
        <div>
          <p id={headingId} className="admin-sibling-order-title">
            {title}
          </p>
          <small>{description}</small>
        </div>
        <ListOrdered aria-hidden="true" />
      </div>
      <ol aria-label="Sibling order list">
        {memberIds.map((memberId, index) => {
          const member = membersById.get(memberId);
          if (!member) return null;
          // Native drag-and-drop uses the row as the drop target.
          /* oxlint-disable jsx-a11y/no-noninteractive-element-interactions */
          return (
            <li
              key={member.id}
              className={draggedIndex === index ? 'is-dragging' : undefined}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropMember(index);
              }}
            >
              <button
                type="button"
                className="admin-sibling-order-drag-handle"
                aria-label={`Reorder ${member.fullName}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', member.id);
                  setDraggedIndex(index);
                }}
                onDragEnd={() => setDraggedIndex(null)}
              >
                <GripVertical aria-hidden="true" />
              </button>
              <span className="admin-sibling-order-number">{index + 1}</span>
              <span className="admin-sibling-order-name">
                {member.fullName}
              </span>
              <span className="admin-sibling-order-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${member.fullName} earlier`}
                  disabled={index === 0}
                  onClick={() => moveMember(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${member.fullName} later`}
                  disabled={index === memberIds.length - 1}
                  onClick={() => moveMember(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </span>
            </li>
          );
          /* oxlint-enable jsx-a11y/no-noninteractive-element-interactions */
        })}
      </ol>
      {onSave && (
        <Button
          type="button"
          size="sm"
          className="admin-sibling-order-save"
          onClick={onSave}
          disabled={pending}
        >
          <Save aria-hidden="true" />
          {pending ? 'Saving…' : 'Save order'}
        </Button>
      )}
    </section>
  );
}
