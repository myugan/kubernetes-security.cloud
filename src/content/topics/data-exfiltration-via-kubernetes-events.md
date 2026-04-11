---
title: Data Exfiltration via Kubernetes Events
description: How attackers can misuse Kubernetes Events to move data out after cluster compromise
category: offensive
createdAt: 2026-04-08
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

After taking over a cluster, attackers need a quiet way to move stolen credentials out. Kubernetes `events` serve as an overlooked staging area. An attacker with `create` permission writes stolen data into event fields that look like normal kubelet output. The control plane stores and serves the events without content inspection. The same API access retrieves the data later, from any session with `get` on `events`.

## RBAC permissions

```yaml
rules:
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "get"]
```

## Spoofing the event source

`source.component`, `source.host`, `reportingComponent`, and `reportingInstance` are all set by the creator. The API server stores whatever value is submitted without validating it against the requesting identity. Setting them to `kubelet` and a valid node name makes the event indistinguishable from a real kubelet event in `kubectl get events` output.

## Encoding stolen credentials

### A1Z26 cipher in numeric fields

Event fields that hold numeric values accept arbitrary integers. The `image size` field in a kubelet pull message is a standard target. A1Z26 maps each letter to its position in the alphabet, two digits per character. The value `190503180520` encodes `SECRET`.

```
19=S  05=E  03=C  18=R  05=E  20=T
```

The event:

```yaml
reason: Pulled
message: "Successfully pulled image \"nginx:1.21.6\" in 1.565s (1.565s including waiting). Image size: 190503180520 bytes."
source:
  component: kubelet
  host: worker-node-1
```

A1Z26 is limited to alphabetic characters. Encoding six letters produces a 12-digit image size, which corresponds to tens of terabytes. This is implausible for a container image. It is better suited for short string labels than for raw credential values.

### Image digest: AWS access key

The `sha256:` digest in a pinned image pull is always 64 hex characters. An attacker hex-encodes a credential value and pads it to 64 characters to fill the field. The AWS access key ID `AKIAIOSFODNN7EXAMPLE` encodes to:

```
AKIAIOSFODNN7EXAMPLE  →  hex  →  414b4941494f53464f444e4e374558414d504c45
```

Padded to 64 characters:

```
414b4941494f53464f444e4e374558414d504c45000000000000000000000000
```

The event message:

```
Successfully pulled image "nginx:1.21.6@sha256:414b4941494f53464f444e4e374558414d504c45000000000000000000000000" in 1.565s (1.565s including waiting). Image size: 134469729 bytes.
```

The image size is the real nginx:1.21.6 size. The message format, timing, and length all match a normal pull. The digest is syntactically valid.

### `reportingInstance`: service account token

`reportingInstance` is not displayed by `kubectl get events` or `kubectl get events -o wide`. It only appears in `-o json` output. The field has no enforced length limit beyond the etcd object ceiling, so it can hold multiple kilobytes. An attacker stores a hex-encoded service account token fragment in this field while the visible message remains a normal pull event.

The Kubernetes service account token header `eyJhbGciOiJSUzI1NiIsImtpZCI6InNvbWUta2lkIn0` encodes to:

```
65794a68624763694f694a53557a49314e694973496d74705a434936496e4e766257557461326c6b496e30
```

The event as stored:

```json
{
  "message": "Successfully pulled image \"nginx:1.21.6\" in 1.565s (1.565s including waiting). Image size: 134469729 bytes.",
  "reportingComponent": "kubelet",
  "reportingInstance": "65794a68624763694f694a53557a49314e694973496d74705a434936496e4e766257557461326c6b496e30",
  "source": { "component": "kubelet", "host": "worker-node-1" }
}
```

An operator running `kubectl get events` sees only the pull message. The token fragment is invisible until someone queries the field explicitly.

## Spreading data across events

A single event carries limited payload. For larger secrets such as a full service account token or a TLS private key, the attacker splits the credential across multiple events in the same or different namespaces, writing each chunk with a sequential label in the name or a counter in the `count` field. The full credential is reassembled on retrieval by reading events in order.

Keeping the message field under 200 bytes matches the size range of real kubelet messages and avoids any length-based anomaly signal.
