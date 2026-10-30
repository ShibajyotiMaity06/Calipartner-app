import { type as typography } from '@calipartner/ui';
import React, { useState, useMemo } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, dark, space, radius } from '@calipartner/ui';
import exercisesSeedData from '@/data/exercises_seed.json';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface AddExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: { name: string; muscleGroup: string; plannedSets: number }) => void;
  initialMuscle?: string;
}

interface MuscleOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  filterValue: string;
}

const MUSCLE_OPTIONS: MuscleOption[] = [
  { key: 'all', label: 'All Body Parts', icon: 'grid-outline', filterValue: 'All' },
  { key: 'chest', label: 'Chest', icon: 'barbell-outline', filterValue: 'chest' },
  { key: 'back', label: 'Back & Traps', icon: 'body-outline', filterValue: 'back' },
  { key: 'shoulders', label: 'Shoulders', icon: 'shield-outline', filterValue: 'shoulders' },
  {
    key: 'arms',
    label: 'Arms (Biceps, Triceps, Forearms)',
    icon: 'fitness-outline',
    filterValue: 'arms',
  },
  {
    key: 'legs',
    label: 'Legs (Quads, Hamstrings, Glutes, Calves)',
    icon: 'walk-outline',
    filterValue: 'legs',
  },
  { key: 'core', label: 'Abs & Core', icon: 'contract-outline', filterValue: 'core' },
  {
    key: 'full_body',
    label: 'Full Body & Explosive',
    icon: 'flash-outline',
    filterValue: 'full_body',
  },
  { key: 'cardio', label: 'Cardio & Conditioning', icon: 'heart-outline', filterValue: 'cardio' },
  { key: 'other', label: 'Mobility & Flexibility', icon: 'leaf-outline', filterValue: 'other' },
];

export function AddExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  initialMuscle = 'All',
}: AddExercisePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState(initialMuscle);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [selectedExerciseName, setSelectedExerciseName] = useState('Barbell Bench Press');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [plannedSets, setPlannedSets] = useState(3);

  React.useEffect(() => {
    if (initialMuscle) {
      setSelectedMuscle(initialMuscle);
    }
  }, [initialMuscle, visible]);

  const currentOption =
    MUSCLE_OPTIONS.find((opt) => opt.filterValue === selectedMuscle) ?? MUSCLE_OPTIONS[0]!;

  const filteredExercises = useMemo(() => {
    return (
      exercisesSeedData as Array<{
        id: string;
        name: string;
        muscle_group: string;
        equipment: string;
      }>
    ).filter((ex) => {
      const matchesSearch =
        !searchQuery.trim() || ex.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesMuscle =
        selectedMuscle === 'All' || ex.muscle_group.toLowerCase() === selectedMuscle.toLowerCase();
      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedMuscle]);

  const handleAdd = () => {
    playSuccessSound();
    const finalName = customExerciseName.trim() || selectedExerciseName || 'Custom Exercise';
    const found = exercisesSeedData.find((e) => e.name.toLowerCase() === finalName.toLowerCase());
    const muscleGroup = found
      ? found.muscle_group.charAt(0).toUpperCase() + found.muscle_group.slice(1)
      : selectedMuscle !== 'All'
        ? selectedMuscle
        : 'Full Body';

    onSelectExercise({
      name: finalName,
      muscleGroup,
      plannedSets,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID="modal-add-exercise-picker"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              testID="btn-close-exercise-picker"
            >
              <Ionicons name="close" size={24} color={dark.textHi} />
            </TouchableOpacity>

            <Text variant="title2" color={dark.textHi} style={styles.title}>
              Choose Exercise
            </Text>

            <View style={{ width: 44 }} />
          </View>

          {/* Search Box */}
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={18}
              color={dark.textLo}
              style={{ marginRight: space[2] }}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search 400+ exercises..."
              placeholderTextColor={dark.textLo}
              style={styles.searchInput}
              testID="input-search-exercise"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={dark.textLo} />
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown Trigger for Body Parts / Muscle Group */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => {
                playClickSound();
                setShowDropdownModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Target muscle group: ${currentOption.label}`}
              testID="btn-bodypart-dropdown"
            >
              <View style={styles.dropdownTriggerLeft}>
                <Ionicons name={currentOption.icon} size={18} color={dark.apricot} />
                <View style={{ marginLeft: space[2] }}>
                  <Text variant="micro" color={dark.textLo} style={{ letterSpacing: 0.5 }}>
                    BODY PART FILTER
                  </Text>
                  <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '700' }}>
                    {currentOption.label}
                  </Text>
                </View>
              </View>

              <View style={styles.dropdownTriggerRight}>
                <View style={styles.countBadge}>
                  <Text variant="micro" color={dark.textHi} style={{ fontWeight: '700' }}>
                    {filteredExercises.length}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={dark.textMid}
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Custom Exercise Write-in */}
          <View style={styles.customRow}>
            <Text variant="micro" color={dark.textLo} style={{ marginBottom: 4 }}>
              CAN&apos;T FIND IT? ADD CUSTOM EXERCISE:
            </Text>
            <TextInput
              value={customExerciseName}
              onChangeText={(text) => {
                setCustomExerciseName(text);
                if (text.trim()) setSelectedExerciseName('');
              }}
              placeholder="e.g. Bulgarian Split Squat, Dragon Flags..."
              placeholderTextColor={dark.textLo}
              style={styles.customInput}
              testID="input-custom-exercise-name"
            />
          </View>

          {/* Sets Config Stepper */}
          <View style={styles.setsPickerRow}>
            <Text variant="body" color={dark.textHi} style={{ fontWeight: '600' }}>
              Planned Sets:
            </Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                onPress={() => {
                  playClickSound();
                  setPlannedSets((prev) => Math.max(1, prev - 1));
                }}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel="Decrease sets"
              >
                <Ionicons name="remove" size={18} color={dark.textHi} />
              </TouchableOpacity>
              <Text variant="title2" color={dark.apricot} style={styles.setsNumberText}>
                {plannedSets}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  playClickSound();
                  setPlannedSets((prev) => Math.min(10, prev + 1));
                }}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel="Increase sets"
              >
                <Ionicons name="add" size={18} color={dark.textHi} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Exercise List */}
          <ScrollView style={styles.exerciseScroll} showsVerticalScrollIndicator={false}>
            {filteredExercises.map((ex) => {
              const isSelected = !customExerciseName.trim() && selectedExerciseName === ex.name;
              return (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => {
                    playClickSound();
                    setSelectedExerciseName(ex.name);
                    setCustomExerciseName('');
                  }}
                  style={[styles.exerciseCard, isSelected && styles.exerciseCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, ${ex.muscle_group}`}
                  testID={`picker-item-${ex.id}`}
                >
                  <View style={styles.exerciseIconCircle}>
                    <Ionicons
                      name="barbell-outline"
                      size={20}
                      color={isSelected ? dark.apricot : dark.textMid}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      variant="body"
                      color={dark.textHi}
                      style={{ fontWeight: isSelected ? '700' : '500' }}
                    >
                      {ex.name}
                    </Text>
                    <View style={styles.tagsRow}>
                      <Text variant="micro" color={dark.textLo} style={styles.tagText}>
                        {ex.muscle_group.toUpperCase()}
                      </Text>
                      <Text variant="micro" color={dark.textLo} style={styles.tagText}>
                        • {ex.equipment}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={dark.apricot} />
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: space[8] }} />
          </ScrollView>

          {/* Bottom Confirm Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleAdd}
              style={styles.addConfirmBtn}
              accessibilityRole="button"
              accessibilityLabel="Add to workout"
              testID="btn-confirm-add-exercise"
            >
              <Ionicons name="checkmark" size={20} color={dark.onBrand} />
              <Text variant="heading" color={dark.onBrand} style={styles.addConfirmBtnText}>
                Add {customExerciseName.trim() || selectedExerciseName || 'Exercise'} ({plannedSets}{' '}
                sets)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown Modal Sheet */}
        <Modal
          visible={showDropdownModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDropdownModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDropdownModal(false)}
          >
            <View style={styles.dropdownModalCard}>
              <View style={styles.dropdownModalHeader}>
                <Text variant="heading" color={dark.textHi}>
                  Select Body Part
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDropdownModal(false)}
                  style={styles.dropdownModalClose}
                >
                  <Ionicons name="close" size={20} color={dark.textMid} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 380 }}>
                {MUSCLE_OPTIONS.map((opt) => {
                  const isOptSelected = selectedMuscle === opt.filterValue;
                  const count = (exercisesSeedData as Array<{ muscle_group: string }>).filter(
                    (e) =>
                      opt.filterValue === 'All' ||
                      e.muscle_group.toLowerCase() === opt.filterValue.toLowerCase(),
                  ).length;

                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.dropdownItemRow,
                        isOptSelected && styles.dropdownItemRowSelected,
                      ]}
                      onPress={() => {
                        playClickSound();
                        setSelectedMuscle(opt.filterValue);
                        setShowDropdownModal(false);
                      }}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <Ionicons
                          name={opt.icon}
                          size={20}
                          color={isOptSelected ? dark.apricot : dark.textMid}
                        />
                        <Text
                          variant="body"
                          color={isOptSelected ? dark.apricot : dark.textHi}
                          style={{
                            marginLeft: space[3],
                            fontWeight: isOptSelected ? '700' : '400',
                          }}
                        >
                          {opt.label}
                        </Text>
                      </View>

                      <View style={styles.dropdownItemRight}>
                        <Text variant="micro" color={dark.textLo} style={{ marginRight: 6 }}>
                          {count}
                        </Text>
                        {isOptSelected && (
                          <Ionicons name="checkmark" size={18} color={dark.apricot} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#120A04',
  },
  container: {
    flex: 1,
    backgroundColor: '#120A04',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: '#2B1A0D',
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1109',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#382212',
    marginHorizontal: space[4],
    marginTop: space[3],
    paddingHorizontal: space[3],
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: dark.textHi,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
  },
  dropdownContainer: {
    marginHorizontal: space[4],
    marginTop: space[2],
    marginBottom: space[2],
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1109',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#382212',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: 50,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: '#2A170B',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#382212',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  dropdownModalCard: {
    backgroundColor: '#1C1109',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#382212',
    paddingVertical: space[3],
    overflow: 'hidden',
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: '#2B1A0D',
  },
  dropdownModalClose: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: '#2A170B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#221308',
  },
  dropdownItemRowSelected: {
    backgroundColor: '#261408',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customRow: {
    marginHorizontal: space[4],
    marginBottom: space[2],
  },
  customInput: {
    backgroundColor: '#1C1109',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#382212',
    paddingHorizontal: space[3],
    height: 42,
    color: dark.textHi,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
  },
  setsPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space[4],
    marginVertical: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: '#1A0E06',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#2D180B',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: '#2A170B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setsNumberText: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '700',
  },
  exerciseScroll: {
    flex: 1,
    paddingHorizontal: space[4],
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0E06',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#261408',
    padding: space[3],
    marginBottom: space[2],
    gap: space[3],
  },
  exerciseCardActive: {
    borderColor: dark.apricot,
    backgroundColor: '#261408',
  },
  exerciseIconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: '#261408',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  tagText: {
    letterSpacing: 0.5,
  },
  bottomBar: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: '#160C05',
    borderTopWidth: 1,
    borderTopColor: '#2B1A0D',
  },
  addConfirmBtn: {
    height: 52,
    backgroundColor: dark.apricot,
    borderRadius: radius.control,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[2],
  },
  addConfirmBtnText: {
    fontWeight: '700',
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
  },
});
