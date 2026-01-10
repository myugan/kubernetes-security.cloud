/**
 * MITRE ATT&CK for Containers/Kubernetes Techniques
 * Reference: https://attack.mitre.org/matrices/enterprise/containers/
 */

import type { MitreTechnique } from '../types';

/**
 * MITRE ATT&CK technique database
 */
export const mitreTechniques: Record<string, MitreTechnique> = {
  T1610: {
    id: 'T1610',
    name: 'Deploy Container',
    tactic: 'Execution',
    description:
      'Adversaries may deploy a container into an environment to facilitate execution or evade defenses.',
    url: 'https://attack.mitre.org/techniques/T1610',
  },
  T1059: {
    id: 'T1059',
    name: 'Command and Scripting Interpreter',
    tactic: 'Execution',
    description:
      'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.',
    url: 'https://attack.mitre.org/techniques/T1059',
  },
  T1078: {
    id: 'T1078',
    name: 'Valid Accounts',
    tactic: 'Initial Access, Persistence, Privilege Escalation, Defense Evasion',
    description:
      'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.',
    url: 'https://attack.mitre.org/techniques/T1078',
  },
  T1082: {
    id: 'T1082',
    name: 'System Information Discovery',
    tactic: 'Discovery',
    description:
      'An adversary may attempt to get detailed information about the operating system and hardware.',
    url: 'https://attack.mitre.org/techniques/T1082',
  },
  T1018: {
    id: 'T1018',
    name: 'Remote System Discovery',
    tactic: 'Discovery',
    description:
      'Adversaries may attempt to get a listing of other systems by IP address, hostname, or other logical identifier on a network.',
    url: 'https://attack.mitre.org/techniques/T1018',
  },
  T1021: {
    id: 'T1021',
    name: 'Remote Services',
    tactic: 'Lateral Movement',
    description:
      'Adversaries may use remote services to move between systems and access remote resources.',
    url: 'https://attack.mitre.org/techniques/T1021',
  },
  T1055: {
    id: 'T1055',
    name: 'Process Injection',
    tactic: 'Defense Evasion, Privilege Escalation',
    description:
      'Adversaries may inject code into processes in order to evade process-based defenses as well as possibly elevate privileges.',
    url: 'https://attack.mitre.org/techniques/T1055',
  },
  T1543: {
    id: 'T1543',
    name: 'Create or Modify System Process',
    tactic: 'Persistence, Privilege Escalation',
    description:
      'Adversaries may create or modify system processes to repeatedly execute malicious payloads as part of persistence.',
    url: 'https://attack.mitre.org/techniques/T1543',
  },
  T1136: {
    id: 'T1136',
    name: 'Create Account',
    tactic: 'Persistence',
    description:
      'Adversaries may create an account to maintain access to victim systems.',
    url: 'https://attack.mitre.org/techniques/T1136',
  },
  T1070: {
    id: 'T1070',
    name: 'Indicator Removal on Host',
    tactic: 'Defense Evasion',
    description:
      'Adversaries may delete or modify artifacts generated on a host system to remove evidence of their presence or hinder defenses.',
    url: 'https://attack.mitre.org/techniques/T1070',
  },
  T1562: {
    id: 'T1562',
    name: 'Impair Defenses',
    tactic: 'Defense Evasion',
    description:
      'Adversaries may maliciously modify components of a victim environment in order to hinder or disable defensive mechanisms.',
    url: 'https://attack.mitre.org/techniques/T1562',
  },
  T1046: {
    id: 'T1046',
    name: 'Network Service Scanning',
    tactic: 'Discovery',
    description:
      'Adversaries may scan for network services to identify potential targets or gather information.',
    url: 'https://attack.mitre.org/techniques/T1046',
  },
  T1105: {
    id: 'T1105',
    name: 'Ingress Tool Transfer',
    tactic: 'Command and Control',
    description:
      'Adversaries may transfer tools or other files from an external system into a compromised environment.',
    url: 'https://attack.mitre.org/techniques/T1105',
  },
  T1110: {
    id: 'T1110',
    name: 'Brute Force',
    tactic: 'Credential Access',
    description:
      'Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.',
    url: 'https://attack.mitre.org/techniques/T1110',
  },
  T1552: {
    id: 'T1552',
    name: 'Unsecured Credentials',
    tactic: 'Credential Access',
    description:
      'Adversaries may search compromised systems to find and obtain insecurely stored credentials.',
    url: 'https://attack.mitre.org/techniques/T1552',
  },
  T1486: {
    id: 'T1486',
    name: 'Data Encrypted for Impact',
    tactic: 'Impact',
    description:
      'Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability to system and network resources.',
    url: 'https://attack.mitre.org/techniques/T1486',
  },
  T1496: {
    id: 'T1496',
    name: 'Resource Hijacking',
    tactic: 'Impact',
    description:
      'Adversaries may leverage the resources of co-opted systems in order to solve resource intensive problems which may impact system and/or hosted service availability.',
    url: 'https://attack.mitre.org/techniques/T1496',
  },
  T1190: {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    tactic: 'Initial Access',
    description:
      'Adversaries may attempt to exploit a weakness in an Internet-facing host or system to initially access a network.',
    url: 'https://attack.mitre.org/techniques/T1190',
  },
  T1611: {
    id: 'T1611',
    name: 'Escape to Host',
    tactic: 'Privilege Escalation',
    description:
      'Adversaries may break out of a container to gain access to the underlying host.',
    url: 'https://attack.mitre.org/techniques/T1611',
  },
  T1068: {
    id: 'T1068',
    name: 'Exploitation for Privilege Escalation',
    tactic: 'Privilege Escalation',
    description:
      'Adversaries may exploit software vulnerabilities in an attempt to elevate privileges.',
    url: 'https://attack.mitre.org/techniques/T1068',
  },
  T1548: {
    id: 'T1548',
    name: 'Abuse Elevation Control Mechanism',
    tactic: 'Privilege Escalation, Defense Evasion',
    description:
      'Adversaries may circumvent mechanisms designed to control elevate privileges to gain higher-level permissions.',
    url: 'https://attack.mitre.org/techniques/T1548',
  },
  T1069: {
    id: 'T1069',
    name: 'Permission Groups Discovery',
    tactic: 'Discovery',
    description:
      'Adversaries may attempt to discover group and permission settings.',
    url: 'https://attack.mitre.org/techniques/T1069',
  },
  T1530: {
    id: 'T1530',
    name: 'Data from Cloud Storage',
    tactic: 'Collection',
    description:
      'Adversaries may access data from cloud storage.',
    url: 'https://attack.mitre.org/techniques/T1530',
  },
  T1040: {
    id: 'T1040',
    name: 'Network Sniffing',
    tactic: 'Credential Access, Discovery',
    description:
      'Adversaries may sniff network traffic to capture information about an environment.',
    url: 'https://attack.mitre.org/techniques/T1040',
  },
};

/**
 * Get a MITRE technique by ID
 */
export function getMitreTechnique(id: string): MitreTechnique | undefined {
  return mitreTechniques[id];
}

/**
 * Get all MITRE techniques
 */
export function getAllMitreTechniques(): MitreTechnique[] {
  return Object.values(mitreTechniques);
}

/**
 * Get techniques filtered by tactic
 */
export function getTechniquesByTactic(tactic: string): MitreTechnique[] {
  return Object.values(mitreTechniques).filter((tech) =>
    tech.tactic.toLowerCase().includes(tactic.toLowerCase())
  );
}
