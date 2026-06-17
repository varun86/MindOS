import { Globe, BookOpen, FileText, Home, Users, PenLine, Briefcase, FlaskConical } from 'lucide-react';
import type { SpaceKitId, Template } from './types';

export const TEMPLATES: Array<{ id: Template; icon: React.ReactNode; dirs: string[] }> = [
  { id: 'en', icon: <Globe size={18} />, dirs: ['Profile/', 'Connections/', 'Notes/', 'Workflows/', 'Resources/', 'Projects/'] },
  { id: 'zh', icon: <BookOpen size={18} />, dirs: ['画像/', '关系/', '笔记/', '流程/', '资源/', '项目/'] },
  { id: 'empty', icon: <FileText size={18} />, dirs: ['README.md', 'CONFIG.json', 'INSTRUCTION.md'] },
];

export const SPACE_KITS: Array<{ id: SpaceKitId; icon: React.ReactNode }> = [
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
