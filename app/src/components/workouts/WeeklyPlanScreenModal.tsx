import React from 'react';
import { Modal } from 'react-native';
import WeeklyPlanScreen from '@/app/weekly-plan';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
export function WeeklyPlanScreenModal({ onClose }: { onClose: () => void }) {
  useBrowserModalBack(true, onClose);
  return (
    <Modal visible onRequestClose={onClose} animationType="slide" testID="workout-weekly-plan">
      <WeeklyPlanScreen onClose={onClose} />
    </Modal>
  );
}
