import type { Equipment, Exercise, ExerciseType, MuscleGroup } from './types';

const VALID_MUSCLE_GROUPS: ReadonlySet<MuscleGroup> = new Set([
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio',
  'other',
]);

const VALID_EQUIPMENT: ReadonlySet<Equipment> = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
  'none',
]);

const VALID_EXERCISE_TYPES: ReadonlySet<ExerciseType> = new Set([
  'strength',
  'cardio',
  'bodyweight',
  'duration',
  'distance',
]);

export interface RawExerciseInput {
  id?: string;
  name: string;
  muscle_group: string;
  equipment: string;
  type: string;
  attribution?: string | null;
  owner_id?: string | null;
}

export function validateAndNormalizeExercise(
  raw: RawExerciseInput,
  defaultOwnerId: string | null = null,
  defaultAttribution = 'CaliPartner Open Exercise Library (CC-BY-4.0)',
): Exercise {
  const name = raw.name ? raw.name.trim() : '';
  if (!name) {
    throw new Error('Validation failed: Exercise name cannot be empty');
  }

  const muscleGroup = (raw.muscle_group ? raw.muscle_group.trim().toLowerCase() : '') as MuscleGroup;
  if (!VALID_MUSCLE_GROUPS.has(muscleGroup)) {
    throw new Error(
      `Validation failed: Invalid muscle group "${raw.muscle_group}". Allowed: ${Array.from(VALID_MUSCLE_GROUPS).join(', ')}`,
    );
  }

  const equipment = (raw.equipment ? raw.equipment.trim().toLowerCase() : '') as Equipment;
  if (!VALID_EQUIPMENT.has(equipment)) {
    throw new Error(
      `Validation failed: Invalid equipment "${raw.equipment}". Allowed: ${Array.from(VALID_EQUIPMENT).join(', ')}`,
    );
  }

  const type = (raw.type ? raw.type.trim().toLowerCase() : 'strength') as ExerciseType;
  if (!VALID_EXERCISE_TYPES.has(type)) {
    throw new Error(
      `Validation failed: Invalid exercise type "${raw.type}". Allowed: ${Array.from(VALID_EXERCISE_TYPES).join(', ')}`,
    );
  }

  const id = raw.id && raw.id.trim() ? raw.id.trim() : crypto.randomUUID();
  const owner_id = raw.owner_id !== undefined ? raw.owner_id : defaultOwnerId;
  const attribution = raw.attribution && raw.attribution.trim() ? raw.attribution.trim() : defaultAttribution;

  return {
    id,
    name,
    muscle_group: muscleGroup,
    equipment,
    type,
    owner_id,
    attribution,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
}

/**
 * Imports exercises from JSON string or Array.
 */
export function importExercisesFromJson(
  jsonData: string | RawExerciseInput[],
  options?: { ownerId?: string | null; defaultAttribution?: string },
): Exercise[] {
  let parsed: RawExerciseInput[];
  if (typeof jsonData === 'string') {
    try {
      parsed = JSON.parse(jsonData);
    } catch (err) {
      throw new Error(`JSON parse error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    parsed = jsonData;
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Import error: Expected JSON array of exercises');
  }

  return parsed.map((item, idx) => {
    try {
      return validateAndNormalizeExercise(
        item,
        options?.ownerId ?? null,
        options?.defaultAttribution,
      );
    } catch (err) {
      throw new Error(`Item [${idx}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

/**
 * Parses a simple CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Imports exercises from a CSV string.
 * Supports headers: id, name, muscle_group, equipment, type, attribution
 */
export function importExercisesFromCsv(
  csvData: string,
  options?: { ownerId?: string | null; defaultAttribution?: string },
): Exercise[] {
  const lines = csvData
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV error: File must contain a header row and at least one data row');
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('CSV error: File must contain a header row and at least one data row');
  }
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().replace(/[\s-]/g, '_'));

  const nameIdx = headers.indexOf('name');
  const muscleIdx = headers.indexOf('muscle_group');
  const equipmentIdx = headers.indexOf('equipment');
  const typeIdx = headers.indexOf('type');
  const idIdx = headers.indexOf('id');
  const attributionIdx = headers.indexOf('attribution');

  if (nameIdx === -1 || muscleIdx === -1 || equipmentIdx === -1) {
    throw new Error(
      'CSV error: Required header columns (name, muscle_group, equipment) not found',
    );
  }

  const exercises: Exercise[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseCsvLine(line);
    const raw: RawExerciseInput = {
      id: idIdx !== -1 && cols[idIdx] ? cols[idIdx] : undefined,
      name: cols[nameIdx] || '',
      muscle_group: cols[muscleIdx] || '',
      equipment: cols[equipmentIdx] || '',
      type: typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx] : 'strength',
      attribution: attributionIdx !== -1 && cols[attributionIdx] ? cols[attributionIdx] : undefined,
    };

    try {
      exercises.push(
        validateAndNormalizeExercise(
          raw,
          options?.ownerId ?? null,
          options?.defaultAttribution,
        ),
      );
    } catch (err) {
      throw new Error(`Line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return exercises;
}
