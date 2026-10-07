import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityState,
  type ColorValue,
  type GestureResponderEvent,
} from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName, focusedName: IconName) {
  return function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  };
}

/** Raised center "Log" button. Placeholder only; no logging behaviour yet. */
interface LogTabButtonProps {
  onPress?: ((e: GestureResponderEvent) => void) | null;
  accessibilityState?: AccessibilityState;
}

function LogTabButton({ onPress, accessibilityState }: LogTabButtonProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.logWrap}>
      <Pressable
        onPress={onPress ?? undefined}
        accessibilityRole="button"
        accessibilityLabel={t('tabs.log')}
        accessibilityState={accessibilityState}
        testID="tab-log"
        style={[
          styles.logButton,
          { backgroundColor: colors.accent, borderColor: colors.background },
        ]}
      >
        <Ionicons name="add" size={32} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarIcon: icon('today-outline', 'today'),
          tabBarButtonTestID: 'tab-today',
        }}
      />
      <Tabs.Screen
        name="room"
        options={{
          title: t('tabs.room'),
          tabBarIcon: icon('people-outline', 'people'),
          tabBarButtonTestID: 'tab-room',
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t('tabs.log'),
          tabBarLabel: () => null,
          tabBarButton: (props) => <LogTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: icon('stats-chart-outline', 'stats-chart'),
          tabBarButtonTestID: 'tab-progress',
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabs.me'),
          tabBarIcon: icon('person-outline', 'person'),
          tabBarButtonTestID: 'tab-me',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logWrap: { flex: 1, alignItems: 'center' },
  logButton: {
    top: -16,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
