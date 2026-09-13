function headConflictError(currentHead) {
  return Object.assign(
    new Error(`${currentHead.fullName} is already the current clan head`),
    {
      status: 409,
      code: 'CLAN_HEAD_CONFLICT',
      details: {
        currentHeadId: currentHead.id,
        currentHeadName: currentHead.fullName,
      },
    },
  );
}

function validationError(message) {
  return Object.assign(new Error(message), {
    status: 422,
    code: 'VALIDATION_ERROR',
  });
}

export function createClanHeadChangeEvent({ oldHead, newHead, date }) {
  const relatedMemberIds = [oldHead?.id, newHead?.id].filter(Boolean);
  const description = oldHead && newHead
    ? `Trưởng họ được chuyển từ ${oldHead.fullName} sang ${newHead.fullName}.`
    : oldHead
      ? `${oldHead.fullName} được ghi nhận là cựu trưởng họ.`
      : `${newHead.fullName} được ghi nhận là trưởng họ.`;
  return {
    title: 'Thay đổi trưởng họ',
    type: 'clan-ceremony',
    calendar: 'solar',
    day: date.day,
    month: date.month,
    recurrence: 'once',
    event_year: date.year,
    location: '',
    description,
    relatedMemberIds,
  };
}

export function resolveClanHeadChange({
  currentMember,
  currentHead,
  requestedMember,
  confirmHeadChange,
}) {
  const isCurrentMember = currentMember?.isClanHead === true;
  const isRequestedCurrent = requestedMember.isClanHead === true;
  const isRequestedPrevious = requestedMember.isPreviousClanHead === true;

  if (isRequestedCurrent && isRequestedPrevious) {
    throw validationError('A member cannot be both current and previous clan head');
  }

  if (isRequestedCurrent && requestedMember.status === 'deceased') {
    if (!isCurrentMember) {
      throw validationError('A deceased member cannot be the current clan head');
    }
  }

  const isAutomaticPrevious =
    isCurrentMember && requestedMember.status === 'deceased';
  const wantsCurrent = isRequestedCurrent && !isAutomaticPrevious;
  const currentHeadIsAnotherMember =
    wantsCurrent && currentHead && currentHead.id !== requestedMember.id;

  if (currentHeadIsAnotherMember && !confirmHeadChange) {
    throw headConflictError(currentHead);
  }

  const nextIsClanHead = wantsCurrent;
  const nextIsPreviousClanHead = isAutomaticPrevious
    ? true
    : isRequestedPrevious;
  const currentHeadId = currentHead?.id ?? null;
  const newHeadId = nextIsClanHead
    ? requestedMember.id
    : isCurrentMember
      ? null
      : currentHeadId;
  const headChanged = currentHeadId !== newHeadId;

  return {
    isClanHead: nextIsClanHead,
    isPreviousClanHead: nextIsPreviousClanHead,
    previousHeadId: headChanged ? currentHeadId : null,
    newHeadId,
    headChanged,
  };
}
