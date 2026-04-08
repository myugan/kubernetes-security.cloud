---
title: Data Exfiltration via Kubernetes Events
description: How attackers can misuse Kubernetes Events to move data out after cluster compromise
category: offensive
impact: >-
  An attacker with cluster access and permission to create `events` can hide stolen data inside normal-looking event messages. Because Events are expected control-plane traffic, this can blend into noise and bypass checks that focus only on pods, secrets, and network egress.
mitigation:
  - Treat `create` on `events` as a sensitive permission. Most workloads do not need broad event-write access.
  - Alert on unusual event volume, long messages, and encoded-looking content from unexpected identities.
  - Correlate suspicious event writes with node compromise signals and unusual secret-access activity.
  - Export Events to centralized logging so short retention does not erase investigation evidence.
mitreTechniques:
  - T1537
  - T1530
tools:
  - kubectl
references: |
  - [Kubernetes Event API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.30/#event-v1-core)
  - [Events in Kubernetes](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_events/)
---

After taking over a cluster, attackers often need a quiet way to move data out. One overlooked option is Kubernetes `events`. If they can write to the `events` resource, they can publish normal-looking messages while embedding stolen data in the message field.

This works because Events are normal. A compromised node can collect data and write small chunks across multiple event objects. The attacker can later use the Kubernetes API access to read those Events and fetch the data, without installing extra tools on the target.

## How this abuse works

Attackers do not need to create another way to send data out when the control plane already stores and serves Events. They can write messages that look normal, post them slowly, and spread them across namespaces so activity is less obvious.

## Common events you normally see

Most clusters generate routine events from the scheduler, kubelet, controllers, and autoscalers. Typical examples include pod scheduling updates, image pull results, container start/restart notices, readiness/liveness probe failures, back-off or crash-loop warnings, and scaling decisions.

In normal operations, event messages are short and tied to a clear object lifecycle change. They usually describe what happened (`Scheduled`, `Pulling`, `Started`, `BackOff`, `Failed`) and which object was affected. `kubectl describe pod` helps with quick troubleshooting, but it is not enough here. You also need to inspect cluster events (`kubectl get events`), because unusual event messages may be missed.

Sample manifest for a legitimate-looking event object:

```yaml
apiVersion: v1
kind: Event
metadata:
  name: nginx-7d9b4c-xk9p2.18a45e7e41549f71
  namespace: default
  creationTimestamp: "2026-04-08T11:44:55Z"
eventTime: null
firstTimestamp: "2026-04-08T11:34:09Z"
lastTimestamp: "2026-04-08T11:44:55Z"
involvedObject:
  apiVersion: v1
  kind: Pod
  name: nginx-7d9b4c-xk9p2
  namespace: default
reason: Pulled
message: "Successfully pulled image \"nginx:1.21.6\" in 1.565s (1.565s including waiting). Image size: 190503180520 bytes."
type: Normal
source:
  component: kubelet
  host: worker-node-1
```

Do not assume large numeric values are always benign. Attackers may hide data inside fields that appear normal at first glance. In the example above, it may look benign, but the byte value can encode letters using the `A1Z26 cipher`.

## RBAC permissions

`create` on `events` is the key permission because it allows new event records to be written, `get` allows those event records to be read.

Even when hidden data is split across events, records can still look normal at a glance. Later, equivalent API access from another environment or session can use `get events` to read those messages and combine the chunks.

Sample RBAC `rules` for this action (applies whether permissions come from a `Role` or `ClusterRole`):

```yaml
rules:
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "get"]
```
