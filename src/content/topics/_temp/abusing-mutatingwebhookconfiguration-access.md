---
title: Abusing MutatingWebhookConfiguration Access
description: How attackers can misuse MutatingWebhookConfiguration access to alter workloads during admission
category: offensive
impact: >-
  An attacker who can create or update `MutatingWebhookConfiguration` can silently rewrite pod specs before they are stored. That can lead to credential theft, secret exposure, persistence, and broad control over workload behavior across namespaces.
mitigation:
  - Keep `create`, `update`, `patch`, and `delete` on `mutatingwebhookconfigurations` extremely limited. Treat it as cluster-critical admin capability.
  - Require signed and reviewed webhook manifests, pin webhook backend images, and protect webhook TLS secrets and CA bundles.
  - Monitor and alert on all changes to `MutatingWebhookConfiguration`, including webhook `clientConfig`, `failurePolicy`, `namespaceSelector`, and `rules`.
  - Use RBAC least privilege and policy guardrails so namespace operators cannot register cluster-wide admission webhooks.
mitreTechniques:
  - T1098
  - T1578
  - T1552
tools:
  - kubectl
references: |
  - [Dynamic Admission Control](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/)
  - [Admission Webhook Good Practices](https://kubernetes.io/docs/concepts/cluster-administration/admission-webhooks-good-practices/)
  - [MutatingWebhookConfiguration API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.30/#mutatingwebhookconfiguration-v1-admissionregistration-k8s-io)
---

`MutatingWebhookConfiguration` is a high-impact control-plane resource. A mutating webhook runs before objects are stored, so it can rewrite pod specs, labels, env vars, volumes, security settings, and images.

If an attacker gets write access here, they do not need direct write access to each target workload. They change admission behavior once and let normal deployment traffic carry the mutation.

An attacker with credentials that can modify `mutatingwebhookconfigurations` can change webhook routing and widen matching so normal pod creation flows through the mutation path. They can then inject sidecars, add risky runtime settings, rewrite images, or keep persistence by mutating future pods.

## RBAC permission

In Kubernetes RBAC, `MutatingWebhookConfiguration` is cluster-scoped. The key part to review is the `rules` block.

High-risk rule shape (too broad for most environments):

```yaml
rules:
  - apiGroups: ["admissionregistration.k8s.io"]
    resources: ["mutatingwebhookconfigurations"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

Read-only rule shape:

```yaml
rules:
  - apiGroups: ["admissionregistration.k8s.io"]
    resources: ["mutatingwebhookconfigurations"]
    verbs: ["get", "list", "watch"]
```

In RBAC review, treat `create`, `update`, `patch`, and `delete` on `mutatingwebhookconfigurations` as high-impact permissions.

## How abuse works

If an identity can write `mutatingwebhookconfigurations`, it can alter the default admission path for future workloads. Instead of touching each workload directly, the attacker changes mutation behavior once and lets normal deploys and autoscaling spread the effect.

This is easier to hide where mutation is already common, such as service-mesh sidecar injection. The first sign is often subtle: extra fields or drift between source manifests and live pods.

## What increases impact

Small webhook edits can have wide impact. Changes to `rules`, `scope`, `namespaceSelector`, `objectSelector`, or `failurePolicy` can expand impact from one namespace to many. Changes to `clientConfig.service` or `clientConfig.url` can reroute admission calls to an untrusted endpoint.

## Key permission check

The core gate is write access to admissionregistration resources:

```bash
kubectl auth can-i update mutatingwebhookconfigurations.admissionregistration.k8s.io
kubectl auth can-i patch mutatingwebhookconfigurations.admissionregistration.k8s.io
kubectl auth can-i create mutatingwebhookconfigurations.admissionregistration.k8s.io
```

If any of these return yes for broad user groups, service accounts, or CI identities, treat it as a priority finding.

Admission control is a trust boundary, not just a feature toggle. If the wrong identity can write it, normal cluster activity can carry persistent mutation.

## Command reference

Check whether your current identity can modify mutating webhooks:

```bash
kubectl auth can-i create mutatingwebhookconfigurations.admissionregistration.k8s.io
kubectl auth can-i update mutatingwebhookconfigurations.admissionregistration.k8s.io
kubectl auth can-i patch mutatingwebhookconfigurations.admissionregistration.k8s.io
kubectl auth can-i delete mutatingwebhookconfigurations.admissionregistration.k8s.io
```

List all mutating webhook configurations:

```bash
kubectl get mutatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations -o yaml
```

Print high-impact fields in a compact view:

```bash
kubectl get mutatingwebhookconfigurations -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .webhooks[*]}  {.name}{" | failurePolicy="}{.failurePolicy}{" | clientConfig.service.name="}{.clientConfig.service.name}{" | clientConfig.url="}{.clientConfig.url}{"\n"}{end}{"\n"}{end}'
```

Watch for live changes:

```bash
kubectl get mutatingwebhookconfigurations -w
```

