/**
 * Centralized type definitions for the Kubernetes Security website
 */

// =============================================================================
// Content Types
// =============================================================================

/** Glossary entry categories */
export type GlossaryCategory = 'concept' | 'component' | 'security' | 'attack' | 'defense';

/** Topic categories */
export type TopicCategory = 'offensive' | 'defensive' | 'fundamental';

/** Topic difficulty levels */
export type TopicLevel = 'beginner' | 'intermediate' | 'advanced';

/** Attack path step types */
export type AttackStepType = 'initial' | 'lateral' | 'privilege' | 'persistence' | 'exfiltration';

/** Tool types */
export type ToolType = 'offensive' | 'defensive' | 'audit' | 'compliance';

// =============================================================================
// Tool Interface
// =============================================================================

export interface Tool {
  name: string;
  url: string;
  type: ToolType | ToolType[];  // Can be single type or array of types
}

// =============================================================================
// Attack Path Types
// =============================================================================

export interface AttackStep {
  id: string;
  title: string;
  description: string;
  type: AttackStepType;
  connections?: string[];
  mitreTechnique?: string;
  command?: string | string[];
}

export interface AttackPath {
  title: string;
  description: string;
  category: string;
  kubernetesVersion: string | string[];
  mitreTechniques?: string[];
  steps: AttackStep[];
}

// =============================================================================
// MITRE ATT&CK Types
// =============================================================================

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  url: string;
}

// =============================================================================
// UI Types
// =============================================================================

export interface ColorScheme {
  bg: string;
  text: string;
  border: string;
  icon?: string;
}

export interface CategoryColors extends ColorScheme {
  icon: string;
}

// =============================================================================
// View Types
// =============================================================================

export type ViewMode = 'grid' | 'list';
