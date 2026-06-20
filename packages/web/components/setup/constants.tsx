import { BookOpen, Home, Users, PenLine, Briefcase, FlaskConical } from 'lucide-react';
import type { InitialSpaceId } from './types';

export const INITIAL_SPACES: Array<{ id: InitialSpaceId; icon: React.ReactNode }> = [
  { id: 'life', icon: <Home size={16} /> },
  { id: 'social', icon: <Users size={16} /> },
  { id: 'learning', icon: <BookOpen size={16} /> },
  { id: 'content', icon: <PenLine size={16} /> },
  { id: 'product', icon: <Briefcase size={16} /> },
  { id: 'research', icon: <FlaskConical size={16} /> },
];

export const TOTAL_STEPS = 3;
export const STEP_MIND_SPACE = 0;
export const STEP_AI = 1;
export const STEP_REVIEW = 2;
