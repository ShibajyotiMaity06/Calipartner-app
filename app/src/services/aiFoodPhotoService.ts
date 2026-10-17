import {
  calculateCompressedDimensions,
  DEFAULT_AI_FOOD_PHOTO_CAPS,
  resolveUnitGrams,
  scaleNutrients,
  stripImageExif,
  validateFoodPhotoImage,
  type AiFoodPhotoErrorCode,
  type AiUserState,
  type Food,
  type FoodCandidateItem,
  type FoodEntry,
  type FoodPhotoAnalysisResponse,
  type MealSection,
  type VisionModelResponse,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { logFoodEntry } from './foodService';
import type { SyncDb } from './syncService';

const log = createLogger('aiFoodPhotoService');

export class AiFoodPhotoServiceError extends Error {
  constructor(
    public readonly code: AiFoodPhotoErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AiFoodPhotoServiceError';
  }
}

export interface PreparedPhotoPayload {
  imageBase64: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface SupabaseFunctionsClient {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from?: (table: string) => {
    select: (cols: string) => {
      eq: (col1: string, val1: unknown) => {
        eq: (col2: string, val2: unknown) => {
          limit: (n: number) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
    };
    insert: (val: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  functions?: {
    invoke: (name: string, options: { body: unknown }) => Promise<{
      data: Record<string, unknown> | null;
      error: { message?: string; status?: number } | null;
    }>;
  };
}

/**
 * Checks whether the user has recorded explicit AI processing consent (PRD 8.2).
 */
export async function checkAiProcessingConsent(
  supabase: SupabaseFunctionsClient,
  userId: string,
): Promise<boolean> {
  try {
    if (supabase.rpc) {
      const { data, error } = await supabase.rpc('has_ai_processing_consent', {
        p_user_id: userId,
      });
      if (!error && typeof data === 'boolean') {
        return data;
      }
    }

    if (supabase.from) {
      const { data, error } = await supabase
        .from('consent_records')
        .select('id')
        .eq('user_id', userId)
        .eq('consent_type', 'ai_processing')
        .limit(1);

      if (!error && Array.isArray(data)) {
        return data.length > 0;
      }
    }

    return false;
  } catch (err) {
    log.info(`Consent check failed, assuming false: ${err}`);
    return false;
  }
}

/**
 * Records explicit AI processing consent for the current user.
 */
export async function acceptAiProcessingConsent(
  supabase: SupabaseFunctionsClient,
  version = '1.0',
): Promise<void> {
  if (supabase.rpc) {
    const { error } = await supabase.rpc('accept_ai_processing_consent', {
      p_version: version,
    });
    if (error) {
      throw new AiFoodPhotoServiceError('SERVER_ERROR', `Failed to accept consent: ${error.message}`);
    }
    return;
  }

  if (supabase.from) {
    const { error } = await supabase.from('consent_records').insert({
      consent_type: 'ai_processing',
      version,
      accepted_at: new Date().toISOString(),
    });
    if (error) {
      throw new AiFoodPhotoServiceError('SERVER_ERROR', `Failed to accept consent: ${error.message}`);
    }
  }
}

/**
 * Validates, strips device EXIF metadata, computes scaled dimensions,
 * and encodes photograph to Base64 for upload.
 */
export function preparePhotoForAiAnalysis(params: {
  buffer: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
}): PreparedPhotoPayload {
  const mime = params.mimeType.toLowerCase().trim();

  // 1. Validate image format and file size
  const validation = validateFoodPhotoImage(mime, params.buffer.length);
  if (!validation.valid) {
    throw new AiFoodPhotoServiceError(
      validation.errorCode || 'INVALID_IMAGE',
      validation.message || 'Invalid image payload',
    );
  }

  // 2. Strip EXIF and location metadata on device (PRD 8.2)
  const cleanBuffer = stripImageExif(params.buffer, mime);

  // 3. Compute target compressed dimensions (max 1600px longest edge)
  const targetDims = calculateCompressedDimensions(
    params.width || 1600,
    params.height || 1200,
    1600,
  );

  // 4. Encode to Base64 string
  let binaryString = '';
  for (let i = 0; i < cleanBuffer.length; i++) {
    const byte = cleanBuffer[i];
    if (byte !== undefined) {
      binaryString += String.fromCharCode(byte);
    }
  }
  const base64 = typeof btoa !== 'undefined'
    ? btoa(binaryString)
    : Buffer.from(cleanBuffer).toString('base64');

  return {
    imageBase64: base64,
    mimeType: mime,
    sizeBytes: cleanBuffer.length,
    width: targetDims.width,
    height: targetDims.height,
  };
}

/**
 * Sends photograph payload to Edge Function `ai-food-photo` and receives food candidates.
 */
export async function analyzeFoodPhoto(
  supabase: SupabaseFunctionsClient,
  options: {
    imageBase64: string;
    mimeType?: string;
    testMockResponse?: VisionModelResponse;
    testRawOutput?: string;
  },
): Promise<FoodPhotoAnalysisResponse> {
  if (!supabase.functions) {
    throw new AiFoodPhotoServiceError(
      'SERVER_ERROR',
      'Supabase functions client is unavailable',
    );
  }

  const { data, error } = await supabase.functions.invoke('ai-food-photo', {
    body: {
      image: options.imageBase64,
      mime_type: options.mimeType || 'image/jpeg',
      test_mock_response: options.testMockResponse,
      test_raw_output: options.testRawOutput,
    },
  });

  if (error || !data) {
    const errorMsg = error?.message || 'Failed to analyze food photograph';
    const status = error?.status;

    if (errorMsg.includes('CONSENT_REQUIRED') || status === 403) {
      throw new AiFoodPhotoServiceError(
        'CONSENT_REQUIRED',
        'AI processing consent is required to analyze photos.',
      );
    }
    if (errorMsg.includes('DAILY_LIMIT_REACHED') || status === 429) {
      throw new AiFoodPhotoServiceError(
        'DAILY_LIMIT_REACHED',
        'Daily limit of photo scans reached for today.',
      );
    }
    if (
      errorMsg.includes('FEATURE_DISABLED') ||
      errorMsg.includes('BUDGET_EXCEEDED') ||
      status === 503
    ) {
      throw new AiFoodPhotoServiceError(
        'FEATURE_DISABLED',
        'AI photo scanning is temporarily disabled or monthly limit reached.',
      );
    }
    if (errorMsg.includes('UNAUTHENTICATED') || status === 401) {
      throw new AiFoodPhotoServiceError(
        'UNAUTHENTICATED',
        'Authentication required to analyze photos.',
      );
    }

    throw new AiFoodPhotoServiceError('MODEL_ERROR', errorMsg);
  }

  // Check if payload contains an error object returned by Edge Function
  if (data.error && !data.success) {
    const errCode = typeof data.code === 'string' ? data.code : 'MODEL_ERROR';
    const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new AiFoodPhotoServiceError(
      errCode,
      errMsg,
      data,
    );
  }

  return (data as unknown) as FoodPhotoAnalysisResponse;
}

/**
 * Updates a candidate's quantity or serving unit and recalculates live nutrients.
 */
export function updateCandidateQuantity(
  candidate: FoodCandidateItem,
  newQuantity: number,
  newUnit?: string,
): FoodCandidateItem {
  const safeQty = Math.max(0, newQuantity);
  const unit = newUnit || candidate.unit;
  const unitGrams = resolveUnitGrams(candidate.matched_food, unit);
  const estimatedGrams = Math.round(safeQty * unitGrams * 10) / 10;

  const nutrients = scaleNutrients(candidate.matched_food, safeQty, unit);

  return {
    ...candidate,
    quantity: safeQty,
    unit,
    estimated_grams: estimatedGrams,
    nutrients,
    is_estimate: true,
  };
}

/**
 * Swaps a candidate's matched food with an alternative food item
 * from the database or custom foods, preserving quantity and recomputing nutrients.
 */
export function swapCandidateFood(
  candidate: FoodCandidateItem,
  newFood: Food,
): FoodCandidateItem {
  const unitGrams = resolveUnitGrams(newFood, candidate.unit);
  const estimatedGrams = Math.round(candidate.quantity * unitGrams * 10) / 10;
  const nutrients = scaleNutrients(newFood, candidate.quantity, candidate.unit);

  return {
    ...candidate,
    matched_food: newFood,
    estimated_grams: estimatedGrams,
    nutrients,
    is_estimate: true,
  };
}

/**
 * Saves accepted photo candidates into the local diary as FoodEntry items
 * with source = 'photo', marked as estimates, and enqueued into the offline sync outbox.
 */
export async function savePhotoCandidatesToDiary(
  db: SyncDb,
  params: {
    userId: string;
    candidates: FoodCandidateItem[];
    mealSection?: MealSection;
    localDate?: string;
  },
): Promise<FoodEntry[]> {
  const savedEntries: FoodEntry[] = [];

  for (const candidate of params.candidates) {
    if (candidate.quantity <= 0) {
      continue;
    }

    // Ensure food attribution reflects estimate
    const foodToLog: Food = {
      ...candidate.matched_food,
      attribution: candidate.matched_food.attribution || 'AI Estimate',
    };

    const entry = await logFoodEntry(db, {
      userId: params.userId,
      food: foodToLog,
      mealSection: params.mealSection,
      quantity: candidate.quantity,
      unit: candidate.unit,
      localDate: params.localDate,
      source: 'photo', // PRD LOG-3: source = photo
    });

    savedEntries.push(entry);
  }

  log.info(`Saved ${savedEntries.length} photo entries with source=photo to diary`);
  return savedEntries;
}

/**
 * Retrieves current AI photo daily scan limits, used count, and user plan state.
 */
export async function getAiFoodPhotoUsageStatus(
  supabase: SupabaseFunctionsClient,
  userId: string,
): Promise<{
  allowed: boolean;
  userState: AiUserState;
  usedToday: number;
  dailyCap: number;
  remainingToday: number;
  code?: string;
}> {
  if (!supabase.rpc) {
    return {
      allowed: true,
      userState: 'paid',
      usedToday: 0,
      dailyCap: DEFAULT_AI_FOOD_PHOTO_CAPS.paid,
      remainingToday: DEFAULT_AI_FOOD_PHOTO_CAPS.paid,
    };
  }

  try {
    const { data, error } = await supabase.rpc('check_ai_food_photo_access', {
      p_user_id: userId,
    });

    if (error || !data) {
      return {
        allowed: false,
        userState: 'free_after_trial',
        usedToday: 0,
        dailyCap: 0,
        remainingToday: 0,
        code: 'ERROR',
      };
    }

    const res = data as Record<string, unknown>;
    return {
      allowed: Boolean(res.allowed),
      userState: (res.user_state as AiUserState) || 'free_after_trial',
      usedToday: Number(res.used || 0),
      dailyCap: Number(res.cap || 0),
      remainingToday: Number(res.remaining || 0),
      code: typeof res.code === 'string' ? res.code : undefined,
    };
  } catch {
    return {
      allowed: false,
      userState: 'free_after_trial',
      usedToday: 0,
      dailyCap: 0,
      remainingToday: 0,
    };
  }
}
