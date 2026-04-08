---
title: Detecting Process Execution with Tetragon
description: Monitoring suspicious binary execution in containers using eBPF
category: defensive
impact: Critical - Provides deep visibility into process execution, file access, and network activity at the kernel level
mitigation: Deploy Tetragon DaemonSet, create TracingPolicies for security monitoring, and integrate with SIEM
mitreTechniques:
  - T1059
  - T1055
  - T1611
tools:
  - cilium
references: |
  - [Tetragon Documentation](https://tetragon.io/docs/) - Official documentation
  - [Cilium Tetragon](https://github.com/cilium/tetragon) - GitHub repository
---

Tetragon is an eBPF-based security observability and runtime enforcement tool from Cilium. It provides kernel-level visibility into security-relevant events without the overhead of traditional agents.

## What Tetragon Monitors

- Process execution and arguments
- File access and modifications
- Network connections
- System call activity
- Privilege changes

## Installation

```bash
helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system
```

## Viewing Events

```bash
# Stream all security events
kubectl logs -n kube-system ds/tetragon -c export-stdout -f

# Use tetra CLI for formatted output
kubectl exec -n kube-system ds/tetragon -c tetragon -- tetra getevents
```

## TracingPolicy for Process Monitoring

Monitor specific binaries:

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-binaries
spec:
  kprobes:
  - call: "sys_execve"
    selectors:
    - matchBinaries:
      - operator: "In"
        values:
        - "/bin/bash"
        - "/bin/sh"
        - "/usr/bin/curl"
        - "/usr/bin/wget"
```

## File Access Monitoring

Detect access to sensitive files:

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-files
spec:
  kprobes:
  - call: "fd_install"
    selectors:
    - matchArgs:
      - index: 1
        operator: "Prefix"
        values:
        - "/etc/shadow"
        - "/etc/passwd"
        - "/var/run/secrets"
```

## Network Monitoring

Track outbound connections:

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-network
spec:
  kprobes:
  - call: "tcp_connect"
    selectors:
    - matchActions:
      - action: Post
```

## Runtime Enforcement

Block dangerous operations:

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: block-container-escape
spec:
  kprobes:
  - call: "sys_ptrace"
    selectors:
    - matchActions:
      - action: Sigkill
```

## Event Export

Export events to external systems:

```yaml
# In Tetragon Helm values
export:
  stdout:
    enabledEvents:
    - PROCESS_EXEC
    - PROCESS_EXIT
    - PROCESS_KPROBE
```

## Use Cases

- Detecting cryptomining
- Container escape detection
- Lateral movement tracking
- Compliance auditing
- Incident investigation
