---
title: Blocking Untrusted Image Registries with Gatekeeper
description: Restricting container images to approved registries using OPA Gatekeeper
category: defensive
impact: Critical - Blocks resources that violate security policies before they are created
mitigation: Deploy Gatekeeper with constraint templates for your security requirements, start with dry-run mode, and use audit functionality
mitreTechniques:
  - T1610
  - T1068
tools:
  - opa-gatekeeper
references: |
  - [Gatekeeper Documentation](https://open-policy-agent.github.io/gatekeeper/) - Official documentation
  - [Gatekeeper Library](https://open-policy-agent.github.io/gatekeeper-library/) - Pre-built constraint templates
---

OPA Gatekeeper is a customizable admission webhook for Kubernetes that enforces policies using the Open Policy Agent (OPA) engine with Rego language.

## Architecture

1. **ConstraintTemplate** - Defines the policy logic in Rego
2. **Constraint** - Applies the template to specific resources
3. **Gatekeeper Controller** - Admission webhook that evaluates requests

## Installation

```bash
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/master/deploy/gatekeeper.yaml
```

## Creating a Policy

### Step 1: ConstraintTemplate

Define the policy logic:

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels
        
        violation[{"msg": msg}] {
          provided := {label | input.review.object.metadata.labels[label]}
          required := {label | label := input.parameters.labels[_]}
          missing := required - provided
          count(missing) > 0
          msg := sprintf("Missing required labels: %v", [missing])
        }
```

### Step 2: Constraint

Apply the template:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-app-label
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    labels: ["app", "owner"]
```

## Common Policies

### Block Privileged Containers

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8spspprivileged
spec:
  crd:
    spec:
      names:
        kind: K8sPSPPrivileged
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8spspprivileged
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          container.securityContext.privileged
          msg := sprintf("Privileged container not allowed: %v", [container.name])
        }
```

### Require Resource Limits

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8scontainerlimits
spec:
  crd:
    spec:
      names:
        kind: K8sContainerLimits
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8scontainerlimits
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.memory
          msg := sprintf("Container %v has no memory limit", [container.name])
        }
```

## Enforcement Actions

| Action | Behavior |
|--------|----------|
| **deny** | Block violating resources |
| **dryrun** | Log violations without blocking |
| **warn** | Allow but warn user |

## Audit Functionality

Gatekeeper audits existing resources:

```bash
kubectl get k8srequiredlabels require-app-label -o yaml
# Shows violations in existing resources
```

## Using the Policy Library

```bash
# Install pre-built policies
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper-library/master/library/pod-security-policy/privileged-containers/template.yaml
```
