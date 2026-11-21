import React from 'react';
import type { WorkoutWithDetails } from '@calipartner/core';
import { WorkoutRedesignContainer } from './redesign/WorkoutRedesignContainer';

export interface WorkoutHubModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  defaultDate?: string;
  onSaved?: (workout: WorkoutWithDetails) => void;
}
export function WorkoutHubModal(props: WorkoutHubModalProps) {
  return (
    <WorkoutRedesignContainer
      visible={props.visible}
      onClose={props.onClose}
      defaultDate={props.defaultDate}
      testID={props.testID}
    />
  );
}
