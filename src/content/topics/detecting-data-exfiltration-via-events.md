---
title: Detecting Data Exfiltration via Kubernetes Events
description: Identifying abuse of the Kubernetes Events API to smuggle data out of a cluster through event message fields
category: defensive
createdAt: 2026-04-12
impact: An attacker with permission to create events can encode stolen credentials in event fields that appear as normal cluster activity. The audit log records who created each event and when, exposing non-controller identities writing to the events resource.
mitigation:
  - Audit the events resource at Request level in the audit policy to capture message content alongside the creator identity
  - Alert on event creation from any identity outside the known controller allowlist, particularly non-system service accounts or user identities
references: |
  - [Data Exfiltration via Kubernetes Events](/topics/data-exfiltration-via-kubernetes-events)
  - [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
  - [Kubernetes Events API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.30/#event-v1-core)
---

The event below was created by a user, not the kubelet. Both the image size and the source fields are attacker-controlled:

```output
LAST SEEN   TYPE     REASON   OBJECT                   MESSAGE
5m          Normal   Pulled   pod/nginx-7d9b4c-xk9p2   Successfully pulled image "nginx:1.21.6" in 1.565s (1.565s including waiting). Image size: 190503180520 bytes.
6m          Normal   Pulled   pod/nginx                Successfully pulled image "nginx:1.21.6" in 7.425s (7.425s including waiting). Image size: 134469729 bytes.
```

Both events share `reason: Pulled` and the same image name. The malicious one references a pod that does not exist, and the image size is approximately 177GB against the real 128MB for nginx:1.21.6. Neither is a reliable automated signal. The reliable signal is in the audit log.

## How Detection Works

Detection depends on two independent signals. The audit log answers who created an event. The event content answers what was written. At `Metadata` level the audit log captures the creator identity but not the message or numeric field values.

**Signal 1: Creator identity (audit log, Metadata level)**

Every event creation produces a `ResponseComplete` audit entry. An alert fires when an event is created by an identity outside the known controller allowlist. This works at `Metadata` level and requires no special audit policy changes.

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "3489e8b5-0ad7-4189-a85c-d6e404d43076",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/events?fieldManager=kubectl-client-side-apply&fieldValidation=Strict",
  "verb": "create",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "events",
    "namespace": "production",
    "name": "nginx-7d9b4c-xk9p2.18a45e7e41549f71",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestReceivedTimestamp": "2026-04-11T16:39:18.982281Z",
  "stageTimestamp": "2026-04-11T16:39:18.985681Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": ""
  }
}
```

The `user.username` is `jane`, not a controller service account. That is the trigger. The `source.component: kubelet` value inside the event object is not visible here and carries no weight. The API server stores whatever the creator submits.

**Signal 2: Event content (two paths)**

The first path is to query events directly via the API. This shows the full content of every event currently in etcd:

```bash
kubectl get events -n <namespace> -o json \
  | jq '.items[] | {name: .metadata.name, reason: .reason, message: .message, source: .source}'
```

```output
{
  "name": "nginx-7d9b4c-xk9p2.18a45e7e41549f71",
  "reason": "Pulled",
  "message": "Successfully pulled image \"nginx:1.21.6\" in 1.565s (1.565s including waiting). Image size: 190503180520 bytes.",
  "source": { "component": "kubelet", "host": "worker-node-1" }
}
```

The data is in the numeric value `190503180520`. A1Z26 decoding maps each two-digit pair to a letter: `19=S`, `05=E`, `03=C`, `18=R`, `05=E`, `20=T`. The limitation of this path is that events expire out of etcd. Direct inspection only works while the event is still present.

The second path is to raise the audit policy to `Request` level for the `events` resource. This captures the full request body into the audit log at write time, before the event expires:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Request
    resources:
      - group: ""
        resources: ["events"]
    verbs: ["create", "patch"]
  - level: Metadata
    resources:
      - group: ""
        resources: ["*"]
```

With this policy, the audit record includes `requestObject` containing the full event body, captured regardless of whether the event later expires:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Request",
  "auditID": "5e2c019d-1608-4285-ba69-f1e1941a234e",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/events?fieldManager=kubectl-client-side-apply&fieldValidation=Strict",
  "verb": "create",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "objectRef": {
    "resource": "events",
    "namespace": "production",
    "name": "nginx-7d9b4c-xk9p2.18a45e7e41549f71",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestObject": {
    "reason": "Pulled",
    "message": "Successfully pulled image \"nginx:1.21.6\" in 1.565s (1.565s including waiting). Image size: 190503180520 bytes.",
    "source": { "component": "kubelet", "host": "worker-node-1" },
    "type": "Normal"
  },
  "requestReceivedTimestamp": "2026-04-11T16:39:18.982281Z",
  "stageTimestamp": "2026-04-11T16:39:18.985681Z",
  "annotations": { "authorization.k8s.io/decision": "allow", "authorization.k8s.io/reason": "" }
}
```

A SIEM rule scanning `requestObject.message` for numeric values outside the plausible container image size range catches A1Z26-encoded payloads without knowing the cipher.

## Detecting Image Digest and `reportingInstance` Channels

Two other covert channels are harder to spot from the message field alone.

**Image digest**

An attacker encodes a credential such as an AWS access key ID as hex and embeds it in the `sha256:` position of a pinned image digest:

```output
Successfully pulled image "nginx:1.21.6@sha256:414b4941494f53464f444e4e374558414d504c45000000000000000000000000" in 1.565s (1.565s including waiting). Image size: 134469729 bytes.
```

The digest `414b4941494f53464f444e4e374558414d504c45000000000000000000000000` hex-decodes to `AKIAIOSFODNN7EXAMPLE` padded with null bytes. The message format, image size, and digest length are all correct. Detection at `Request` level requires extracting the digest from `requestObject.message` and comparing it against the known real digest for that image tag. Any mismatch is the signal.

**`reportingInstance`**

This field is not displayed by `kubectl get events`. In `-o wide` output it appears in the **SOURCE** column as `kubelet, <value>` alongside the component name, but the hex string blends into the wide table and is easy to overlook. Only `-o json` surfaces it cleanly as a dedicated field. An attacker stores a hex-encoded service account token fragment here while the visible event message remains a normal pull result:

```json
{
  "message": "Successfully pulled image \"order-service:v2.4.1\" in 2.103s (2.103s including waiting). Image size: 134469729 bytes.",
  "reportingComponent": "kubelet",
  "reportingInstance": "65794a68624763694f694a53557a49314e694973496d74705a434936496b4e4b596e6857566b4a5a626a45336444464d513052334f4863774e6c6c5a52454e7a4d304e55634846785a30316b53456b7453453835646c6b6966512e65794a68645751694f6c73696148523063484d364c79397264574a..."
}
```

The `reportingInstance` value hex-decodes to the first chunk of a service account JWT token for `system:serviceaccount:production:deployer`. Three consecutive events carry the full token across three chunks, reassembled on retrieval. Real kubelet events set `reportingInstance` to the node hostname. Any value that is not a valid cluster hostname warrants inspection.

Detection requires an explicit query. The default event list will not surface this:

```bash
kubectl get events -n <namespace> -o json \
  | jq '.items[] | select(.reportingInstance != null and (.reportingInstance | length) > 253) | {name: .metadata.name, reportingInstance}'
```

The hostname length limit of 253 characters is the reliable threshold. Hex-encoded payloads are at minimum hundreds of characters — a 933-character JWT produces 1866 hex characters, split across three chunks of ~622 each. A hostname regex is not sufficient because hex strings consist entirely of `[0-9a-f]`, which passes any `[a-z0-9]` pattern.

## Known Legitimate Event Writers

Any event creation from an identity outside this list warrants investigation:

| Service Account | Creates events for |
| --- | --- |
| `system:serviceaccount:kube-system:replicaset-controller` | ReplicaSet scaling |
| `system:serviceaccount:kube-system:deployment-controller` | Deployment rollouts |
| `system:serviceaccount:kube-system:statefulset-controller` | StatefulSet updates |
| `system:serviceaccount:kube-system:daemon-set-controller` | DaemonSet scheduling |
| `system:serviceaccount:kube-system:job-controller` | Job execution |
| `system:serviceaccount:kube-system:cronjob-controller` | CronJob execution |
| `system:serviceaccount:kube-system:horizontal-pod-autoscaler` | HPA scaling decisions |
| `system:serviceaccount:kube-system:node-controller` | Node lifecycle |

## Querying the Audit Log

Filter event creation by non-system identities on the control plane node:

```bash
grep '"resource":"events"' /var/log/kubernetes/audit.log \
  | grep '"verb":"create"' \
  | grep -v '"username":"system:'
```

Any line remaining was created by a user or non-system service account. A burst of event creations from the same identity across multiple namespaces in a short window is a secondary signal. Legitimate controllers write events scoped to their own namespace and object lifecycle.
