import React from 'react';
import type { WorkoutWithDetails } from '@calipartner/core';
import { WorkoutDayModal } from './WorkoutDayModal';

export interface WorkoutHubModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  defaultDate?: string;
  onSaved?: (workout: WorkoutWithDetails) => void;
}
export function WorkoutHubModal(props: WorkoutHubModalProps) {
  return <WorkoutDayModal {...props} />;
}
