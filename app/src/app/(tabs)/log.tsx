import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors as v1Colors } from '@calipartner/ui/v1';
import { LogSheetModalV1, type LogFlowState } from '@/components/diary/LogSheetModalV1';
import { closeBrowserModalsThen } from '@/hooks/useBrowserModalBack';

const SUPPORTED_FLOWS: readonly LogFlowState[] = [
  'food',
  'describe',
  'workout',
  'water',
  'steps',
  'cardio',
  'cycling',
  'running',
  'weight',
  'fast',
  'scan',
  'photo',
  'recipe',
  'quick_calories',
];

function parseFlowParam(flow?: string): LogFlowState {
  if (flow && SUPPORTED_FLOWS.includes(flow as LogFlowState)) {
    return flow as LogFlowState;
  }
  return 'picker';
}

export default function LogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string }>();
  const requestedFlow = parseFlowParam(params.flow);

  const [sheetVisible, setSheetVisible] = useState(true);
  const [activeInitialFlow, setActiveInitialFlow] = useState<LogFlowState>(requestedFlow);
  const closing = useRef(false);

  useEffect(() => {
    if (!closing.current && requestedFlow !== 'picker') {
      setActiveInitialFlow(requestedFlow);
    }
  }, [requestedFlow]);

  useFocusEffect(
    useCallback(() => {
      closing.current = false;
      setSheetVisible(true);
      if (params.flow) {
        setActiveInitialFlow(parseFlowParam(params.flow));
        router.setParams({ flow: undefined });
      }
      return () => setSheetVisible(false);
    }, [params.flow, router]),
  );

  const handleCloseAll = () => {
    if (closing.current) return;
    closing.current = true;
    setSheetVisible(false);
    setActiveInitialFlow('picker');
    closeBrowserModalsThen(() => {
      if (params.flow) router.setParams({ flow: undefined });
      if (router.canGoBack()) router.back();
      else router.replace('/today');
    });
  };

  return (
    <View style={styles.rootContainer}>
      <LogSheetModalV1
        visible={sheetVisible}
        initialFlow={activeInitialFlow}
        preserveStackWhileHidden
        onClose={handleCloseAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
});
