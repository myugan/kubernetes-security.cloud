---
title: Detecting Permission Enumeration via Audit Logs
description: Spotting enumeration of current RBAC access by auditing SelfSubjectRulesReview events
category: defensive
createdAt: 2026-04-05
impact: >-
  When audit logging records SelfSubjectRulesReview, you can see who listed their effective permissions. When it does not, that enumeration is easy to miss in an investigation.
mitigation:
  - Turn on the Kubernetes audit log and use a policy that records `authorization.k8s.io` `selfsubjectrulesreviews`, or another rule that still catches it (for example a broader resource match).
  - Send audit logs to central storage and keep enough retention for incident response.
  - Treat bumps in SelfSubjectRulesReview as one signal among many. On their own they do not prove malicious intent.
  - Limit who can read audit data and who can edit the audit policy.
tools:
  - kubectl
references: |
  - [Auditing](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/) - Kubernetes audit overview
  - [Audit policy](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/#audit-policy) - rule levels and resources
  - [SelfSubjectRulesReview](https://kubernetes.io/docs/reference/kubernetes-api/authorization-resources/self-subject-rules-review-v1/) - API reference
---

Attackers and insiders often want to know what their current identity can do before they move sideways or try to escalate. One common way is `kubectl auth can-i --list`, which creates a `SelfSubjectRulesReview` in the `authorization.k8s.io` API group. The same call shows up when people debug RBAC honestly. Audit logs can record who asked for that review so you can line it up with other activity.

> [!NOTE]
> Kubernetes audit logging must be enabled on the API server, with an audit policy that records `selfsubjectrulesreviews` and `subjectrulesreviews` (or still matches these requests).

## How the request shows up

`kubectl auth can-i --list` creates a `SelfSubjectRulesReview`. On current Kubernetes APIs that is a `POST` to `/apis/authorization.k8s.io/v1/selfsubjectrulesreviews` with `spec.namespace` set to the namespace you care about (from `-n` or your current context). The audit entry usually shows `verb` set to `create`, the `user` and `groups` fields, and `objectRef` pointing at `selfsubjectrulesreviews`.

If you run the command with `--as` or `--as-group`, check whether the audit payload shows impersonation the way you expect. Behavior depends on how auditing is configured.

### How impersonation is logged

Audit events are written after the API server has authenticated and authorized the request. The caller that actually authenticated (the bearer token, client cert, or whatever your cluster uses) is recorded under `user` with `username` and `groups`.

If the request carried `Impersonate-User`, `Impersonate-Group`, or related headers and the server accepted them, the identity you were acting as is recorded separately under `impersonatedUser`, again with `username` and `groups`. You are not supposed to see a single blended identity, the log keeps the real subject and the impersonated subject apart so you can tell who held the credential and who they became for authorization.

When there is no impersonation, `impersonatedUser` is usually missing or empty. Field names and nesting follow the [Kubernetes audit Event type](https://kubernetes.io/docs/reference/config-api/apiserver-audit.v1/#audit-k8s-io-v1-Event) your audit policy level still has to include enough detail for those fields to appear.

Any client that sends the same `POST` will show up the same way in audit. This matches `kubectl auth can-i --list -n "$NAMESPACE"` if you fill in `TOKEN`, `APISERVER`, `CACERT`, and `NAMESPACE` for your setup.

```bash
TOKEN="<token-for-the-real-identity>"
APISERVER="https://kubernetes.default.svc"
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
NAMESPACE="default"

curl --cacert "$CACERT" \
  -X POST "$APISERVER/apis/authorization.k8s.io/v1/selfsubjectrulesreviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectRulesReview\",\"spec\":{\"namespace\":\"${NAMESPACE}\"}}"
```

The response body includes `status` with the rule lists, which is the same material `kubectl` prints for `--list`. If you are testing impersonation, add the usual `Impersonate-User` and `Impersonate-Group` headers and keep them inside what your RBAC allows.

## Does audit logging record it?

### Policy sketch

Use something your security standards allow. This only shows the rough shape of a rule aimed at that resource:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    verbs: ["create"]
    resources:
      - group: "authorization.k8s.io"
        resources: ["selfsubjectrulesreviews"]
```

`Request` and `RequestResponse` add more payload detail and more noise. `Metadata` is often enough to detect and triage. Log paths and shipping vary by install (local file on the control plane, agent on the node, cloud logging).

Kubernetes audit output is usually newline-delimited JSON. Here is one example of how you might parse it, it reads `/var/log/kubernetes/audit.log`, walks each line, and keeps `ResponseComplete` events for either `selfsubjectrulesreviews` or `subjectrulesreviews`. That catches permission reviews whether the caller used their own identity only or combined them with impersonation (the same audit line shape carries `user` and, when applicable, `impersonatedUser`). Point the path at your real log file and adjust the filter to match how you ship or slice logs.

```bash
cat /var/log/kubernetes/audit.log | jq -R 'fromjson? | select(
    .stage=="ResponseComplete" and
    (.objectRef.resource=="selfsubjectrulesreviews" or
     .objectRef.resource=="subjectrulesreviews")
  )'
```

Example audit event (abbreviated) showing both the authenticated caller and impersonation:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "ba1f4000-c061-43a6-a187-b449c3c1c44e",
  "stage": "ResponseComplete",
  "requestURI": "/apis/authorization.k8s.io/v1/selfsubjectrulesreviews",
  "verb": "create",
  "user": {
    "username": "bob",
    "groups": [
      "demo",
      "system:authenticated"
    ],
    "extra": {
      "authentication.kubernetes.io/credential-id": [
        "X509SHA256=12b6ad02ec15b22053e38c245f8a0124e42c8d008a4b655d39be828e936c3037"
      ]
    }
  },
  "impersonatedUser": {
    "username": "arbitrary",
    "groups": [
      "system:masters",
      "system:authenticated"
    ]
  },
  "sourceIPs": [
    "192.168.49.1"
  ],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "selfsubjectrulesreviews",
    "apiGroup": "authorization.k8s.io",
    "apiVersion": "v1"
  },
  "responseStatus": {
    "metadata": {},
    "code": 201
  },
  "requestReceivedTimestamp": "2026-04-05T06:31:19.547038Z",
  "stageTimestamp": "2026-04-05T06:31:19.548962Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": ""
  }
}
```

- `user` is the authenticated subject (who signed the request). When impersonation was used, `impersonatedUser` is the identity the server treated as effective for that call.
- `responseStatus.code` is the HTTP-style status from the API server (for example `201` or `200` when things worked).
- `stageTimestamp` (or `requestReceivedTimestamp`) is when the stage was recorded on the event.

Admins and CI run `--list` for good reasons all the time. Treat this as one clue next to other signals, not as a smoking gun on its own.

If you never turned on auditing or the backend, enumeration will not show up in the Kubernetes audit trail. You might still have provider control-plane logs. That depends on the platform. Busy clusters sometimes aggregate or sample logs. Make sure your pipeline is not dropping the lines you need.

It is not just kubectl. Any code path that creates the same object (SDKs, controllers, one-off scripts) produces the same audit shape. Other authorization APIs exist (`SelfSubjectAccessReview`, `SubjectAccessReview`, and others).