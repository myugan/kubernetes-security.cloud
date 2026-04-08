---
title: Denying Latest Image Tag with Kyverno
description: Preventing deployment of containers using the latest tag
category: defensive
impact: Critical - Enforces security policies, compliance requirements, and best practices across all workloads
mitigation: Start with audit mode policies, gradually move to enforce mode, and use policy reports for visibility
mitreTechniques:
  - T1610
  - T1068
tools:
  - kubectl
references: |
  - [Kyverno Documentation](https://kyverno.io/docs/) - Official documentation
  - [Kyverno Policies](https://kyverno.io/policies/) - Policy library
---

Kyverno is a policy engine designed specifically for Kubernetes. It allows you to validate, mutate, and generate Kubernetes resources using policies written as Kubernetes resources.

## Policy Types

| Type | Purpose |
|------|---------|
| **Validate** | Check if resources meet criteria |
| **Mutate** | Automatically modify resources |
| **Generate** | Create new resources based on triggers |

## Installation

```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno -n kyverno --create-namespace
```

## Validation Policy Example

Block privileged containers:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged
spec:
  validationFailureAction: Enforce
  rules:
  - name: deny-privileged
    match:
      any:
      - resources:
          kinds:
          - Pod
    validate:
      message: "Privileged containers are not allowed"
      pattern:
        spec:
          containers:
          - securityContext:
              privileged: "!true"
```

## Mutation Policy Example

Add default security context:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-security-context
spec:
  rules:
  - name: add-run-as-non-root
    match:
      any:
      - resources:
          kinds:
          - Pod
    mutate:
      patchStrategicMerge:
        spec:
          securityContext:
            runAsNonRoot: true
            seccompProfile:
              type: RuntimeDefault
```

## Generation Policy Example

Auto-create NetworkPolicy for new namespaces:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-default-deny
spec:
  rules:
  - name: create-network-policy
    match:
      any:
      - resources:
          kinds:
          - Namespace
    generate:
      kind: NetworkPolicy
      name: default-deny
      namespace: "{{request.object.metadata.name}}"
      data:
        spec:
          podSelector: {}
          policyTypes:
          - Ingress
          - Egress
```

## Validation Failure Actions

| Action | Behavior |
|--------|----------|
| **Enforce** | Block non-compliant resources |
| **Audit** | Allow but report violations |

## Viewing Policy Reports

```bash
# List policy reports
kubectl get policyreport -A

# View violations
kubectl get policyreport -n default -o yaml
```

## Common Security Policies

- Require resource limits
- Disallow latest image tag
- Require labels on resources
- Block hostPath volumes
- Enforce image registry restrictions
