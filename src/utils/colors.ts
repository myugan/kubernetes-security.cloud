/**
 * Color utility functions for consistent styling across the application
 */

import type { CategoryColors, ColorScheme } from '../types';

/**
 * Color mappings for different categories
 */
const categoryColorMap: Record<string, CategoryColors> = {
  // Glossary categories
  concept: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'text-blue-600',
  },
  component: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: 'text-purple-600',
  },
  security: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
  attack: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600',
  },
  defense: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
  },

  // Topic categories
  offensive: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    icon: 'text-orange-600',
  },
  defensive: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
  },
  fundamental: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: 'text-slate-600',
  },

  // Attack path step types
  initial: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600',
  },
  lateral: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
  },
  privilege: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: 'text-purple-600',
  },
  persistence: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    icon: 'text-cyan-600',
  },
  exfiltration: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
};

/**
 * Default colors for unknown categories
 */
const defaultCategoryColors: CategoryColors = {
  bg: 'bg-gray-50',
  text: 'text-gray-700',
  border: 'border-gray-300',
  icon: 'text-gray-600',
};

/**
 * Get color classes for a category
 */
export function getCategoryColors(category: string): CategoryColors {
  return categoryColorMap[category.toLowerCase()] ?? defaultCategoryColors;
}

/**
 * Color mappings for difficulty levels
 */
const levelColorMap: Record<string, ColorScheme> = {
  beginner: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  intermediate: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  advanced: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

/**
 * Default colors for unknown levels
 */
const defaultLevelColors: ColorScheme = {
  bg: 'bg-gray-50',
  text: 'text-gray-700',
  border: 'border-gray-300',
};

/**
 * Get color classes for a difficulty level
 */
export function getLevelColors(level: string): ColorScheme {
  return levelColorMap[level.toLowerCase()] ?? defaultLevelColors;
}

/**
 * Tool type color mappings
 */
const toolTypeColorMap: Record<string, ColorScheme> = {
  offensive: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  defensive: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  audit: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  compliance: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
};

/**
 * Default colors for unknown tool types
 */
const defaultToolTypeColors: ColorScheme = {
  bg: 'bg-gray-50',
  text: 'text-gray-700',
  border: 'border-gray-200',
};

/**
 * Get color classes for a tool type
 */
export function getToolTypeColors(type: string): ColorScheme {
  return toolTypeColorMap[type.toLowerCase()] ?? defaultToolTypeColors;
}
