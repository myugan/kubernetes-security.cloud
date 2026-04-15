/**
 * Color utility functions for consistent styling (light + dark)
 */

import type { CategoryColors, ColorScheme } from '../types';

const categoryColorMap: Record<string, CategoryColors> = {
  concept: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  component: {
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  security: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  attack: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
  },
  defense: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  offensive: {
    bg: 'bg-red-100 dark:bg-red-950/70',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
    icon: 'text-red-700 dark:text-red-300',
  },
  defensive: {
    bg: 'bg-blue-100 dark:bg-blue-950/70',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    icon: 'text-blue-700 dark:text-blue-300',
  },
  fundamental: {
    bg: 'bg-app-surface-muted/70',
    text: 'text-app-text-secondary',
    border: 'border-app-border',
    icon: 'text-app-text-muted',
  },
  initial: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
  },
  lateral: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-700 dark:text-yellow-400',
  },
  privilege: {
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  persistence: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/50',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    icon: 'text-cyan-700 dark:text-cyan-400',
  },
  exfiltration: {
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
  },
};

const defaultCategoryColors: CategoryColors = {
  bg: 'bg-app-surface-muted/70',
  text: 'text-app-text-secondary',
  border: 'border-app-border',
  icon: 'text-app-text-muted',
};

export function getCategoryColors(category: string): CategoryColors {
  return categoryColorMap[category.toLowerCase()] ?? defaultCategoryColors;
}

const levelColorMap: Record<string, ColorScheme> = {
  beginner: {
    bg: 'bg-green-50 dark:bg-emerald-950/50',
    text: 'text-green-700 dark:text-emerald-300',
    border: 'border-green-200 dark:border-emerald-800',
  },
  intermediate: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  advanced: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
};

const defaultLevelColors: ColorScheme = {
  bg: 'bg-app-surface-muted/70',
  text: 'text-app-text-secondary',
  border: 'border-app-border',
};

export function getLevelColors(level: string): ColorScheme {
  return levelColorMap[level.toLowerCase()] ?? defaultLevelColors;
}

const toolTypeColorMap: Record<string, ColorScheme> = {
  offensive: {
    bg: 'bg-red-100 dark:bg-red-950/70',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
  },
  defensive: {
    bg: 'bg-blue-100 dark:bg-blue-950/70',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
  },
  audit: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  compliance: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
};

const defaultToolTypeColors: ColorScheme = {
  bg: 'bg-app-surface-muted/70',
  text: 'text-app-text-secondary',
  border: 'border-app-border',
};

export function getToolTypeColors(type: string): ColorScheme {
  return toolTypeColorMap[type.toLowerCase()] ?? defaultToolTypeColors;
}
