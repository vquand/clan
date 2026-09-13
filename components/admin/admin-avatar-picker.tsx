'use client';

import { Check, ImagePlus, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { AdminMemberInput } from '@/lib/admin-contract';
import { compressAvatarImage } from '@/lib/avatar-image';
import { getMemberAvatarSource } from '@/lib/member-display';
import type { Member, MemberAvatarStyle } from '@/data/types';

const avatarStyles: MemberAvatarStyle[] = [
  'default',
  'style-1',
  'style-2',
  'style-3',
];

type AvatarChoice =
  | { kind: 'system'; style: MemberAvatarStyle }
  | { kind: 'custom'; image: string };

function initialChoice(member: Member): AvatarChoice {
  const customImage = member.avatarImageUrl?.trim();
  if (customImage) return { kind: 'custom', image: customImage };
  return { kind: 'system', style: member.avatarStyle ?? 'default' };
}

function avatarLabel(style: MemberAvatarStyle) {
  return style === 'default'
    ? 'Default avatar'
    : `${style.replace('-', ' ')} avatar`;
}

export function AdminAvatarPicker({
  member,
  pending,
  onSave,
}: {
  member: Member;
  pending: boolean;
  onSave: (
    input: Pick<AdminMemberInput, 'avatarStyle' | 'avatarImageUrl'>,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<AvatarChoice>(() =>
    initialChoice(member),
  );
  const [customImage, setCustomImage] = useState(
    member.avatarImageUrl?.trim() ?? '',
  );
  const [error, setError] = useState('');
  const fileInputId = `avatar-upload-${member.id}`;

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setChoice(initialChoice(member));
      setCustomImage(member.avatarImageUrl?.trim() ?? '');
      setError('');
    }
    setOpen(nextOpen);
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const image = await compressAvatarImage(file);
      setCustomImage(image);
      setChoice({ kind: 'custom', image });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The image could not be added.',
      );
    }
  }

  async function save() {
    if (pending) return;
    const input =
      choice.kind === 'custom'
        ? {
            avatarStyle: member.avatarStyle ?? 'default',
            avatarImageUrl: customImage,
          }
        : {
            avatarStyle: choice.style,
            avatarImageUrl: undefined,
          };
    const saved = await onSave(input);
    if (saved) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="admin-record-avatar admin-record-avatar-trigger"
            aria-label={`Choose avatar for ${member.fullName}`}
          />
        }
      >
        <Image
          src={getMemberAvatarSource(member)}
          alt=""
          width={96}
          height={116}
          unoptimized
        />
        {(member.isClanHead || member.isPreviousClanHead) && (
          <span
            className={`member-avatar__head-marker ${
              member.isClanHead
                ? 'member-avatar__head-marker--current'
                : 'member-avatar__head-marker--previous'
            }`}
            aria-hidden="true"
          >
            *
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="admin-avatar-popover"
        aria-label="Choose avatar"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="admin-avatar-popover-header">
          <strong>Choose avatar</strong>
          <span>Pick one system avatar or add one custom image.</span>
        </div>
        <div className="admin-avatar-options">
          {avatarStyles.map((style) => {
            const systemMember = {
              ...member,
              avatarStyle: style,
              avatarImageUrl: undefined,
            };
            const selected = choice.kind === 'system' && choice.style === style;
            return (
              <button
                key={style}
                type="button"
                className="admin-avatar-option"
                aria-label={avatarLabel(style)}
                aria-pressed={selected}
                onClick={() => setChoice({ kind: 'system', style })}
              >
                <Image
                  src={getMemberAvatarSource(systemMember)}
                  alt=""
                  width={48}
                  height={64}
                  unoptimized
                />
                <span>
                  {style === 'default' ? 'Default' : style.replace('-', ' ')}
                </span>
                {selected && <Check aria-hidden="true" />}
              </button>
            );
          })}
          {customImage ? (
            <button
              type="button"
              className="admin-avatar-option"
              aria-label="Custom avatar"
              aria-pressed={choice.kind === 'custom'}
              onClick={() => setChoice({ kind: 'custom', image: customImage })}
            >
              <Image
                src={customImage}
                alt=""
                width={48}
                height={64}
                unoptimized
              />
              <span>Custom</span>
              {choice.kind === 'custom' && <Check aria-hidden="true" />}
            </button>
          ) : (
            <label
              className="admin-avatar-option admin-avatar-option--upload"
              htmlFor={fileInputId}
            >
              <ImagePlus aria-hidden="true" />
              <span>Add image</span>
            </label>
          )}
        </div>
        {customImage && (
          <label className="admin-avatar-upload-button" htmlFor={fileInputId}>
            <Upload aria-hidden="true" />
            Replace custom image
          </label>
        )}
        <input
          id={fileInputId}
          className="admin-avatar-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        {error && (
          <p className="admin-avatar-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-avatar-popover-actions">
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save avatar'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
