/**
 * Tools data loader
 *
 * Loads tool definitions from tools.yaml
 * Content files (topics, glossary) reference tools by key name
 */

import type { Tool, ToolType } from '../types';
import toolsData from './tools.yaml';

export interface ToolDefinition extends Tool {
  description?: string;
}

interface RawToolData {
  name: string;
  url: string;
  type: string | string[];  // Can be single type or array
  description?: string;
}

// Type the imported YAML data
const rawTools = toolsData as Record<string, RawToolData>;

/**
 * Normalize type to always be an array for consistency in processing
 */
function normalizeType(type: string | string[]): ToolType | ToolType[] {
  if (Array.isArray(type)) {
    return type as ToolType[];
  }
  return type as ToolType;
}

// Convert to typed tools object
export const tools: Record<string, ToolDefinition> = Object.fromEntries(
  Object.entries(rawTools).map(([key, tool]) => [
    key,
    {
      name: tool.name,
      url: tool.url,
      type: normalizeType(tool.type),
      description: tool.description,
    },
  ])
);

/**
 * Get types as array (for consistent iteration)
 */
export function getToolTypes(tool: ToolDefinition): ToolType[] {
  return Array.isArray(tool.type) ? tool.type : [tool.type];
}

/**
 * Get a tool by its key/name
 */
export function getTool(key: string): ToolDefinition | undefined {
  // Try exact key match first
  if (tools[key]) {
    return tools[key];
  }

  // Try case-insensitive match
  const lowerKey = key.toLowerCase();
  for (const [k, tool] of Object.entries(tools)) {
    if (k.toLowerCase() === lowerKey || tool.name.toLowerCase() === lowerKey) {
      return tool;
    }
  }

  return undefined;
}

/**
 * Get multiple tools by their keys/names
 */
export function getTools(keys: string[]): ToolDefinition[] {
  return keys
    .map((key) => getTool(key))
    .filter((tool): tool is ToolDefinition => tool !== undefined);
}

/**
 * Get all tools
 */
export function getAllTools(): ToolDefinition[] {
  return Object.values(tools);
}

/**
 * Get tools by type (matches if tool has the type in its type array)
 */
export function getToolsByType(type: ToolType): ToolDefinition[] {
  return Object.values(tools).filter((tool) => {
    const types = getToolTypes(tool);
    return types.includes(type);
  });
}
