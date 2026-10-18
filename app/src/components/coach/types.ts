export type CoachRole = 'user' | 'assistant';

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
