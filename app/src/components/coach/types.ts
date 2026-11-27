import type { CoachMealDraft, CoachStructuredCard } from '@calipartner/core';
export type CoachRole = 'user' | 'assistant';

export interface CoachAttachedMeal {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CoachSuggestion {
  id: string;
  type: 'recipe' | 'food';
  title: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recipeId?: string;
  foodId?: string;
}

export interface CoachMessage {
  mealDraft?: CoachMealDraft | null;
  mealLogged?: boolean;
  card?: CoachStructuredCard | null;
  quickReplies?: string[];
  attachedMeal?: CoachAttachedMeal | null;
  id: string;
  role: CoachRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  feedback?: 'up' | 'down' | null;
  suggestions?: CoachSuggestion[];
}

export interface CoachConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageSnippet: string;
}

export type CoachReportReason = 'inaccurate' | 'unsafe' | 'disordered' | 'inappropriate' | 'other';
