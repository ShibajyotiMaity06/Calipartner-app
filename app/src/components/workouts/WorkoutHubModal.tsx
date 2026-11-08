import React, { useState } from 'react';
import type { WorkoutWithDetails } from '@calipartner/core';
import { WorkoutLoggerModal } from './WorkoutLoggerModal';
import { WorkoutHistoryCalendarModal } from './WorkoutHistoryCalendarModal';

export interface WorkoutHubModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  defaultDate?: string;
  onSaved?: (workout: WorkoutWithDetails) => void;
}
export function WorkoutHubModal({
  visible,
  onClose,
  testID = 'workout-hub-modal',
  defaultDate,
  onSaved,
}: WorkoutHubModalProps) {
  const [history, setHistory] = useState(false);
  return (
    <>
      <WorkoutLoggerModal
        visible={visible}
        onClose={onClose}
        defaultDate={defaultDate}
        onSaved={onSaved}
        testID={testID}
        onHistory={() => setHistory(true)}
      />
      {history && <WorkoutHistoryCalendarModal visible onClose={() => setHistory(false)} />}
    </>
  );
}
