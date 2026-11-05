import { useRef, useState } from 'react';
import { generateClientUuid } from '@/services/foodService';
import { renameSquad } from '@/services/squadNameService';

export function useRenameSquad(roomId: string) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const request = useRef<{ name: string; id: string } | null>(null);
  const save = async (name: string) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(false);
    const trimmed = name.trim();
    try {
      if (request.current?.name !== trimmed)
        request.current = { name: trimmed, id: generateClientUuid() };
      await renameSquad(roomId, trimmed, request.current.id);
      request.current = null;
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return {
    save,
    saving,
    error,
    clearError: () => {
      request.current = null;
      setError(false);
    },
  };
}
