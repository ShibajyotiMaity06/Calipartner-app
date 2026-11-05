import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Sheet, Text, dark, homeLayout, space } from '@calipartner/ui';
import type { RoomSummary } from '@/types/rooms';
import { useRenameSquad } from '@/hooks/useRenameSquad';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export function EditSquadName({
  room,
  location,
}: {
  room: RoomSummary;
  location: 'home' | 'squad' | 'settings';
}) {
  if (room.role !== 'host' || room.state === 'archived') return null;
  return <SquadNameEditor key={room.id} room={room} location={location} />;
}
function SquadNameEditor({ room, location }: { room: RoomSummary; location: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room.name);
  const { save, saving, error, clearError } = useRenameSquad(room.id);
  const close = () => {
    if (!saving) setOpen(false);
  };
  useBrowserModalBack(open, close);
  const valid = Array.from(name.trim()).length >= 1 && Array.from(name.trim()).length <= 100;
  const id = `${location}-edit-squad-name-${room.id}`;
  return (
    <>
      <Pressable
        onPress={() => {
          setName(room.name);
          clearError();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('squadDesign.editNameFor', { name: room.name })}
        testID={id}
        style={{
          minWidth: homeLayout.touchSize,
          minHeight: homeLayout.touchSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="pencil-outline" size={homeLayout.iconSize} color={dark.copper} />
      </Pressable>
      {open && (
        <Sheet
          visible
          snapPoint="tall"
          onClose={close}
          accessibilityLabel={t('squadDesign.editName')}
          testID="edit-squad-name-sheet"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: space[4], gap: space[3] }}
          >
            <Text variant="title2" accessibilityRole="header">
              {t('squadDesign.editName')}
            </Text>
            <Field
              label={t('squadDesign.nameLabel')}
              accessibilityLabel={t('squadDesign.nameLabel')}
              value={name}
              onChangeText={setName}
              editable={!saving}
              autoFocus
              returnKeyType="done"
              testID="input-squad-name"
            />
            {!valid && (
              <Text variant="bodyS" color="danger" accessibilityRole="alert">
                {t('squadDesign.nameLength')}
              </Text>
            )}
            {error && (
              <Text
                variant="bodyS"
                color="danger"
                accessibilityRole="alert"
                testID="squad-name-error"
              >
                {t('squadDesign.nameSaveError')}
              </Text>
            )}
            <View style={{ gap: space[2] }}>
              <Button
                label={t(saving ? 'squadDesign.savingName' : 'squadDesign.saveName')}
                disabled={saving || !valid || name.trim() === room.name}
                onPress={async () => {
                  if (await save(name)) setOpen(false);
                }}
                testID="save-squad-name"
              />
              <Button
                variant="secondary"
                label={t('common.cancel')}
                disabled={saving}
                onPress={close}
                testID="cancel-squad-name"
              />
            </View>
          </ScrollView>
        </Sheet>
      )}
    </>
  );
}
