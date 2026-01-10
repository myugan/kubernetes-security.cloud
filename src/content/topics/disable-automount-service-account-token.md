---
title: Disable Automatic Mounting of Default Service Account Tokens
description: Preventing token theft by controlling service account token mounting
category: defensive
impact: The default service account is not inherently privileged and only becomes a risk when associated with elevated roles or role bindings.
mitigation: 
  - Disable automounting for service accounts that don't need API access
  - Create dedicated accounts with minimal permissions
references: |
  - [Configure Service Accounts for Pods](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/) - Official documentation on service account configuration
---

By default, Kubernetes automatically mounts a service account token into every pod. While the default service account has minimal permissions, custom service accounts with elevated RBAC roles become dangerous attack vectors when their tokens are auto-mounted.

The **default** service account in the cluster has **no special permissions** by default. An attacker stealing a default SA token can only:

- Authenticate to the API server
- Get denied on most operations since it's not bound to any role with elevated permissions

The real risk is with **custom service accounts** that have been granted elevated permissions via **RoleBindings** or **ClusterRoleBindings**.

Anyone who has access to the pod will be able to fetch the default token using the command below:

```bash
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)

curl -k -H "Authorization: Bearer $TOKEN" \
  https://kubernetes.default.svc/api/v1/namespaces/default/secrets
```

```output
{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Failure",
  "message": "secrets is forbidden: User \"system:serviceaccount:default:default\" cannot list resource \"secrets\" in API group \"\" in the namespace \"default\"",
  "reason": "Forbidden",
  "details": {
    "kind": "secrets"
  },
  "code": 403
}
```

If you try accessing different resources (pods, deployments, configmaps, etc.), most requests will be denied with the default token.

## Disabling Auto-Mounting

You can set **automountServiceAccountToken: false** on the **default** service account to prevent pods from automatically mounting the token:

```yaml
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
automountServiceAccountToken: false
EOF
```

## When to Disable

Disable auto-mounting when the application:
- Does not need to communicate with the Kubernetes API
- Only needs external service access
- Uses external identity providers