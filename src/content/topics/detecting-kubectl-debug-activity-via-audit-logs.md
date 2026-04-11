---
title: Detecting kubectl debug Activity via Audit Logs
description: Identifying ephemeral container injection and node debug pod creation through API server audit events
category: defensive
createdAt: 2026-04-12
impact: kubectl debug leaves distinct audit events regardless of whether the session is interactive or not. Ephemeral container injection and node debug pod creation each produce unique API calls that do not appear in normal workload operations, making them reliable signals for detecting debug access in production.
mitigation:
  - Alert on patch events against the pods/ephemeralcontainers subresource, which is only used when kubectl debug attaches an ephemeral container to a running pod
  - Alert on pod creation where the pod name matches the node-debugger-* pattern, which kubectl debug node generates automatically
  - Cross-reference both signals against known break-glass users and namespaces to filter out legitimate operator activity
references: |
  - [Weaponizing kubectl debug](/topics/weaponizing-kubectl-debug)
  - [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
  - [Ephemeral Containers](https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/)
---

`kubectl debug` runs in two modes. The first attaches an ephemeral container directly to a running pod without restarting it. The second creates a new pod on a specific node with host access. Both modes produce audit events that do not appear during normal workload operations.

## Ephemeral Container Injection

When `kubectl debug` runs against a running pod, kubectl first reads the current pod spec, then patches the **`pods/ephemeralcontainers`** subresource to inject the debug container. No controller or scheduler touches this subresource during normal cluster operation. A `patch` event against it is always user-initiated.

### 1. Initial pod read

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods/order-service-589fc77b9d-82k28",
  "verb": "get",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "name": "order-service-589fc77b9d-82k28",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-04-11T15:47:09.499970Z",
  "stageTimestamp": "2026-04-11T15:47:09.503218Z",
  "annotations": { "authorization.k8s.io/decision": "allow", "authorization.k8s.io/reason": "" }
}
```

### 2. Ephemeral container injection

Arrives milliseconds later from the same user and source IP:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods/order-service-589fc77b9d-82k28/ephemeralcontainers",
  "verb": "patch",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "name": "order-service-589fc77b9d-82k28",
    "apiVersion": "v1",
    "subresource": "ephemeralcontainers"
  },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-04-11T15:47:09.553192Z",
  "stageTimestamp": "2026-04-11T15:47:09.560775Z",
  "annotations": { "authorization.k8s.io/decision": "allow", "authorization.k8s.io/reason": "" }
}
```

The **`subresource: ephemeralcontainers`** field in `objectRef` is the primary signal. This is the event to alert on.

### 3. Log retrieval

Once the container starts, kubectl fetches session output via `pods/log`:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods/order-service-589fc77b9d-82k28/log",
  "verb": "get",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "name": "order-service-589fc77b9d-82k28",
    "apiVersion": "v1",
    "subresource": "log"
  },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-04-11T15:47:14.591913Z",
  "stageTimestamp": "2026-04-11T15:47:14.598203Z",
  "annotations": { "authorization.k8s.io/decision": "allow", "authorization.k8s.io/reason": "" }
}
```

The `pods/log` access from the same user and source IP arriving seconds after the `pods/ephemeralcontainers` patch corroborates that the debug session ran and produced output.

## Node Debug Pod Creation

`kubectl debug node/<node>` produces a pod with these characteristics:

- **Name** follows the pattern `node-debugger-<node-name>-<random-suffix>`, generated by kubectl
- **Namespace** is wherever the caller specifies with `-n`, defaulting to `default`
- **No `ownerReferences`** — not managed by any controller
- **Persists** in `Completed` state after the session ends and must be removed manually

### Pod creation event

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/default/pods",
  "verb": "create",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "default",
    "name": "node-debugger-worker-node-1-qqxwt",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestReceivedTimestamp": "2026-04-11T15:46:26.960836Z",
  "stageTimestamp": "2026-04-11T15:46:26.967515Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "",
    "pod-security.kubernetes.io/enforce-policy": "privileged:latest"
  }
}
```

The **`pod-security.kubernetes.io/enforce-policy: privileged:latest`** annotation confirms the pod was admitted under the `privileged` policy, consistent with a node debug pod that mounts the host filesystem.

### Pod deletion event

When the pod is removed, the audit log records a `delete` event for the same pod name:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "e5f6a7b8-c9d0-1234-efab-345678901234",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/default/pods/node-debugger-worker-node-1-qqxwt",
  "verb": "delete",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "default",
    "name": "node-debugger-worker-node-1-qqxwt",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-04-11T15:51:11.595603Z",
  "stageTimestamp": "2026-04-11T15:51:11.602418Z",
  "annotations": { "authorization.k8s.io/decision": "allow", "authorization.k8s.io/reason": "" }
}
```

The `create` and `delete` pair for a `node-debugger-*` pod from the same user within a short window is the full audit footprint of a node debug session.

## Querying the Audit Log

On self-managed clusters, filter the log file on the control plane node. For ephemeral container injection:

```bash
grep '"subresource":"ephemeralcontainers"' /var/log/kubernetes/audit.log \
  | grep '"verb":"patch"'
```

For node debug pod creation:

```bash
grep '"verb":"create"' /var/log/kubernetes/audit.log \
  | grep '"resource":"pods"' \
  | grep 'node-debugger-'
```

## Limitations

Both signals depend on audit logging capturing the `pods` resource at `Metadata` level or higher. A minimal policy that covers both:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: ""
        resources: ["pods"]
```

The `node-debugger-` prefix is generated by the kubectl client. A user creating a node debug pod via a raw API call can choose any pod name, bypassing that signal. The `pods/ephemeralcontainers` subresource signal is not bypassable in the same way because the subresource is fixed by the Kubernetes API regardless of the client used.
