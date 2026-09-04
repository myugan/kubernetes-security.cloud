/**
 * Attack path visualization utilities for Cytoscape.js
 */

import type { AttackPath } from '../types';

// =============================================================================
// Cytoscape.js Types
// =============================================================================

export interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    title: string;
    type: string;
    description: string;
    stepNumber: number;
  };
}

const LABEL_MAX = 42;

function truncateLabel(text: string, max = LABEL_MAX): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
  };
}

export interface CytoscapeData {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

// =============================================================================
// Data Generation
// =============================================================================

/**
 * Generate Cytoscape.js compatible data from an attack path
 */
export function generateCytoscapeData(attackPath: AttackPath): CytoscapeData {
  const { steps } = attackPath;
  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];

  steps.forEach((step, index) => {
    const nodeId = step.id || `step${index}`;

    // Create node
    const title = step.title.trim();
    const shortTitle = truncateLabel(title, 32);
    nodes.push({
      data: {
        id: nodeId,
        label: `${index + 1}\n${shortTitle}`,
        title,
        type: step.type,
        description: step.description.replace(/\s+/g, ' ').trim(),
        stepNumber: index + 1,
      },
    });

    // Create edges
    if (step.connections && step.connections.length > 0) {
      // Use explicit connections if defined
      step.connections.forEach((connId, connIndex) => {
        edges.push({
          data: {
            id: `${nodeId}-${connId}-${connIndex}`,
            source: nodeId,
            target: connId,
          },
        });
      });
    } else if (index < steps.length - 1) {
      // Default to sequential connection
      const nextId = steps[index + 1].id || `step${index + 1}`;
      edges.push({
        data: {
          id: `${nodeId}-${nextId}`,
          source: nodeId,
          target: nextId,
        },
      });
    }
  });

  return { nodes, edges };
}
