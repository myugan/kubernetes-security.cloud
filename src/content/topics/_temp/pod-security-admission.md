---
title: Enforcing Pod Security with PSA
description: Using Pod Security Admission to enforce security standards on pods
category: defensive
impact: Critical - Prevents deployment of insecure pods by enforcing security profiles at namespace level
mitigation: Apply restricted profile to sensitive namespaces, use baseline as default, and monitor violations in audit mode
mitreTechniques:
  - T1610
  - T1611
tools:
  - kubectl
references: |
  - [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/) - Official Kubernetes documentation
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) - Security profiles reference
---

Pod Security Admission (PSA) is a built-in admission controller that enforces Pod Security Standards. It replaced the deprecated PodSecurityPolicy (PSP) starting in Kubernetes 1.25.

## Security Profiles

PSA provides three security profiles:

| Profile | Description |
|---------|-------------|
| **Privileged** | Unrestricted - allows all pod configurations |
| **Baseline** | Minimally restrictive - prevents known privilege escalations |
| **Restricted** | Highly restrictive - follows security best practices |

## Enforcement Modes

| Mode | Behavior |
|------|----------|
| **enforce** | Rejects pods that violate the policy |
| **audit** | Logs violations without blocking |
| **warn** | Sends warning to user but allows creation |

## Applying PSA to Namespaces

Configure PSA using namespace labels:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Testing with Baseline Profile

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: restricted
```

## What Restricted Profile Blocks

- Privileged containers
- Host namespaces (hostPID, hostIPC, hostNetwork)
- Dangerous volume types (hostPath)
- Running as root
- Privilege escalation
- Certain capabilities
- Non-default Seccomp profiles

## Gradual Rollout Strategy

1. **Start with audit mode** - identify violating pods without breaking workloads
2. **Add warn mode** - alert developers to violations
3. **Enable enforce mode** - block non-compliant pods

```yaml
# Gradual rollout labels
labels:
  pod-security.kubernetes.io/audit: restricted
  pod-security.kubernetes.io/warn: restricted
  pod-security.kubernetes.io/enforce: baseline
```

## Exemptions

Configure exemptions for specific use cases:

```yaml
# In kube-apiserver configuration
--admission-control-config-file=/etc/kubernetes/psa-config.yaml
```

```yaml
# psa-config.yaml
apiVersion: pod-security.admission.config.k8s.io/v1
kind: PodSecurityConfiguration
exemptions:
  usernames: []
  namespaces: [kube-system]
  runtimeClasses: []
```
