import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Only a verified account and its current database entitlement unlock scan details. */
export async function canSeeAdvancedNutrition(
  req: Request,
  admin: SupabaseClient | null,
): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token || !admin?.auth?.getUser || !admin.rpc) return false;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return false;
    const result = await admin.rpc('can_view_advanced_nutrition', { p_user_id: data.user.id });
    return !result.error && result.data === true;
  } catch {
    return false;
  }
}
