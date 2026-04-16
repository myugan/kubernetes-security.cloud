---
title: Detecting Impersonation Abuse
description: Identifying impersonation abuse by inspecting the impersonatedUser audit field and reviewing which subjects hold the impersonate verb
category: defensive
createdAt: 2026-04-15
impact: When audit logging records impersonated identity, you can see who someone became for a call. Without it, impersonation blends into normal cluster traffic because authorization runs under the impersonated subject.
mitigation:
  - Enable Kubernetes audit logging with a policy that records requests carrying Impersonate-* headers. The `impersonatedUser` field in audit events is the primary signal.
  - Regularly audit ClusterRoles and ClusterRoleBindings that grant the `impersonate` verb on `users`, `groups`, `serviceaccounts`, or `uids`. Keep the grant narrow and name-bound.
  - Alert on impersonation from identities that should never use it (application ServiceAccounts, CI bots outside break-glass workflows).
  - Treat impersonation of `system:masters`, `system:admin`, or cluster-admin groups as high-priority regardless of source.
references: |
  - [Kubernetes Impersonation](/topics/kubernetes-impersonation)
  - [Audit logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/) — Kubernetes docs
  - [User impersonation](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#user-impersonation) — authentication docs
  - [Audit Event type](https://kubernetes.io/docs/reference/config-api/apiserver-audit.v1/#audit-k8s-io-v1-Event) — field reference for `impersonatedUser`
---

Kubernetes audit events separate the authenticated caller from the impersonated identity. When a request carries `Impersonate-User`, `Impersonate-Group`, or related headers, the API server records the real caller under `user` and the assumed identity under `impersonatedUser`. That split is the detection anchor.

> [!NOTE]
> Kubernetes audit logging must be enabled on the API server. If auditing is off or the policy does not cover the relevant requests, impersonation produces no distinguishable trail.

## Impersonate-* headers

Impersonation is triggered by HTTP headers the client sends alongside a valid `Authorization` header. The API server authenticates the real caller first, then checks whether that caller holds `impersonate` on the attribute being faked. If RBAC allows it, every downstream authorization decision runs as the impersonated identity instead.

The headers and their RBAC mappings are:

| Header | RBAC resource | `apiGroups` | Example |
| --- | --- | --- | --- |
| `Impersonate-User` | `users` | `""` | `Impersonate-User: admin` |
| `Impersonate-Group` | `groups` | `""` | `Impersonate-Group: system:masters` |
| `Impersonate-Uid` | `uids` | `authentication.k8s.io` | `Impersonate-Uid: a1b2c3d4-...` |
| `Impersonate-Extra-<key>` | `userextras/<key>` | `authentication.k8s.io` | `Impersonate-Extra-scopes: read-write` |

Multiple `Impersonate-Group` headers can be sent in one request to assume several groups at once. `Impersonate-User` and `Impersonate-Group` are the most common pair seen in attacks. Together they let a caller with low privileges assume a user and group with high privileges in a single request.

`kubectl --as admin --as-group system:masters` sends the same headers as a raw HTTP client:

```
Impersonate-User: admin
Impersonate-Group: system:masters
```

The `curl` equivalent:

```bash
curl -sk -H "Authorization: Bearer $TOKEN" \
  -H "Impersonate-User: admin" \
  -H "Impersonate-Group: system:masters" \
  "$APISERVER/api/v1/namespaces"
```

> [!IMPORTANT]
> When `resourceNames` is absent from the ClusterRole rule, the `impersonate` grant applies to **any** user, group, or ServiceAccount. An attacker with this grant can become any identity in the cluster, including `system:masters` members. Always bind `impersonate` with explicit `resourceNames` to limit which identities can be assumed.

## Audit policy

`Metadata` level is enough to see `user` and `impersonatedUser`. You do not need `Request` or `RequestResponse` to detect impersonation itself, though those levels add request bodies for deeper investigation.

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    verbs: ["impersonate"]
  - level: Metadata
    resources:
      - group: ""
        resources: ["users", "groups", "serviceaccounts"]
      - group: "authentication.k8s.io"
        resources: ["uids"]
```

A broad catch-all at `Metadata` level also works because `impersonatedUser` appears on every impersonated request regardless of resource.

## How impersonation appears in the audit log

Every audit event written after impersonation contains two identity blocks:

- `user` — the authenticated subject (who presented the credential).
- `impersonatedUser` — the identity the API server used for authorization.

When there is no impersonation, `impersonatedUser` is absent.

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "c72f8a05-9b13-4e91-b5e8-3e1d6f2a4c09",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces",
  "verb": "list",
  "user": {
    "username": "ci-bot",
    "groups": ["system:serviceaccounts", "system:serviceaccounts:ops", "system:authenticated"]
  },
  "impersonatedUser": {
    "username": "admin",
    "groups": ["system:masters", "system:authenticated"]
  },
  "sourceIPs": ["10.0.0.42"],
  "userAgent": "curl/8.5.0",
  "objectRef": {
    "resource": "namespaces",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 200 },
  "requestReceivedTimestamp": "2026-04-15T09:12:33.410221Z",
  "stageTimestamp": "2026-04-15T09:12:33.413581Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": ""
  }
}
```

The `user.username` is `ci-bot`. The `impersonatedUser.username` is `admin` in `system:masters`. That is the detection signal. A caller with low privileges assumed an identity with high privileges.

## Proactive RBAC auditing

### Check who can impersonate identities

List every ClusterRole that grants the `impersonate` verb:

```bash
kubectl get clusterroles -o json \
  | jq -r '.items[] | select(.rules[]?.verbs[]? == "impersonate") | {name: .metadata.name, rules: [.rules[] | select(.verbs[]? == "impersonate") | {resources, resourceNames, apiGroups}]} | "\(.name):\n" + ([.rules[] | "  resources: \(.resources // []), resourceNames: \(.resourceNames // ["(none)"]), apiGroups: \(.apiGroups // [])"] | join("\n"))'
```

For each ClusterRole returned, list the subjects that hold it:

```bash
CLUSTERROLE="impersonator"
kubectl get clusterrolebindings -o json \
  | jq -r --arg cr "$CLUSTERROLE" '
    .items[]
    | select(.roleRef.name == $cr)
    | .subjects[]??
    | "\(.kind)/\(.name) in \(.namespace // "cluster-scope")"
  '
```

Flag bindings where `resourceNames` is absent, the subject is a ServiceAccount in an application namespace, or the impersonated resource includes `system:masters`.

### List all ServiceAccounts that can impersonate

Enumerate every ServiceAccount bound to a ClusterRole with the `impersonate` verb:

```bash
kubectl get clusterroles -o json > /tmp/cr.json && \
kubectl get clusterrolebindings -o json > /tmp/crb.json && \
jq -r --slurpfile cr /tmp/cr.json '
  .items[]
  | select(
      (.roleRef.name) as $crName |
      $cr[0].items[] | select(.metadata.name == $crName and .rules[]?.verbs[]? == "impersonate")
    )
  | .subjects[]?
  | select(.kind == "ServiceAccount")
  | "\(.namespace)/\(.name)"
' /tmp/crb.json
```

Any ServiceAccount in an application namespace (not `kube-system`) that appears here should be reviewed. Application workloads rarely need impersonation.

### Check if a specific identity can impersonate

Test whether a ServiceAccount has the `impersonate` verb on users or groups:

```bash
kubectl auth can-i impersonate users --as=system:serviceaccount:ops:ci-bot
```

```bash
kubectl auth can-i impersonate groups --as=system:serviceaccount:ops:ci-bot
```

A response of `yes` means the identity can impersonate any user or group unless the ClusterRole restricts it with `resourceNames`.

### Enumerate what an identity can do while impersonating

Check if a ServiceAccount can reach sensitive resources while impersonating a privileged user:

```bash
kubectl auth can-i list secrets --as=system:serviceaccount:ops:ci-bot --as=admin
```

```bash
kubectl auth can-i create pods --as=system:serviceaccount:ops:ci-bot --as=admin
```

This reveals the effective permissions the identity gains through impersonation. A `yes` here means the impersonation grant is powerful enough to access cluster secrets or create workloads as the target user.

## Audit log detection queries

### Search audit logs for impersonation evidence

Filter for events where `impersonatedUser` is present:

```bash
cat /var/log/kubernetes/audit.log | jq -R 'fromjson? | select(.impersonatedUser != null)'
```

To see a single event in full:

```bash
cat /var/log/kubernetes/audit.log | jq -R 'fromjson? | select(.impersonatedUser != null)' | head -1 | jq '.'
```

### Impersonation of high privilege groups

```bash
cat /var/log/kubernetes/audit.log \
  | jq -R 'fromjson? | select(
      .impersonatedUser != null and
      (.impersonatedUser.groups // [] | any(. == "system:masters" or . == "cluster-admin"))
    )'
```

Any hit is worth investigating. Legitimate impersonation of `system:masters` is rare and usually confined to break-glass workflows.

### ServiceAccount impersonation targeting cluster admin

```bash
cat /var/log/kubernetes/audit.log \
  | jq -R 'fromjson? | select(
      .impersonatedUser != null and
      (.user.username | startswith("system:serviceaccount:")) and
      (.impersonatedUser.groups // [] | any(. == "system:masters"))
    ) | {auditID, user: .user.username, impersonatedUser: .impersonatedUser.username, verb, resource: .objectRef.resource}'
```

This narrows results to the most dangerous pattern where a workload identity assumes cluster admin privileges.

## Known legitimate impersonation patterns

Not every `impersonatedUser` is hostile. The following are common authorized uses:

| Source | Typical use |
| --- | --- |
| `kubectl --as` / `--as-group` | Admin debugging RBAC for another user |
| CI/CD pipelines | Deploying as a dedicated deployer ServiceAccount |
| Break-glass tools | Temporary admin access through a privileged group |
| Gatekeeper / OPA | Policy controllers testing subject access |

The detection signal is impersonation **outside** these patterns. A burst of impersonation from a ServiceAccount that has never done it before, or impersonation of `system:masters` from an unexpected source IP, should trigger investigation.

## Correlation with other signals

Impersonation rarely happens in isolation. After finding impersonation evidence, check for related activity from the same identity.

### Check for permission enumeration before impersonation

An attacker often enumerates their own permissions before impersonating:

```bash
cat /var/log/kubernetes/audit.log \
  | jq -R 'fromjson? | select(
      .verb == "create" and
      .objectRef.resource == "selfsubjectrulesreviews"
    ) | {user: .user.username, auditID, requestReceivedTimestamp}'
```

A spike in `SelfSubjectRulesReview` requests from the same identity that later impersonated suggests the attacker was mapping their capabilities first.

### Check what the impersonated identity accessed

After identifying the real caller and the impersonated target, look for sensitive actions taken during the impersonation window:

```bash
cat /var/log/kubernetes/audit.log \
  | jq -R 'fromjson? | select(
      .impersonatedUser != null and
      (.objectRef.resource == "secrets" or .objectRef.resource == "pods")
    ) | {auditID, user: .user.username, impersonatedUser: .impersonatedUser.username, verb, resource: .objectRef.resource, namespace: .objectRef.namespace}'
```

This reveals whether the attacker used the assumed identity to read secrets, create privileged pods, or access other sensitive resources.

### Check for source IP anomalies

Impersonation from an unexpected source IP is a strong signal. Filter audit events to compare the source IP against where the ServiceAccount normally runs:

```bash
cat /var/log/kubernetes/audit.log \
  | jq -R 'fromjson? | select(.impersonatedUser != null)' \
  | jq -s 'group_by(.user.username) | map({user: .[0].user.username, count: length, targets: ([.[].impersonatedUser.username] | unique), sourceIPs: ([.[].sourceIPs[]?] | unique)})'
```

Impersonation from a pod IP that does not match the node where the ServiceAccount's workload runs warrants immediate investigation.
