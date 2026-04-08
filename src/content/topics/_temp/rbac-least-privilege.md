---
title: Preventing Wildcard RBAC Permissions
description: Blocking overly permissive roles that grant access to all resources or verbs
category: defensive
impact: Critical - Proper RBAC prevents unauthorized access to cluster resources and limits the blast radius of compromised credentials
mitigation: Define granular roles, avoid cluster-wide permissions, use namespaced RoleBindings, regularly audit permissions, and implement time-bound access for administrators
mitreTechniques:
  - T1078
  - T1098
  - T1136
tools:
  - kubectl
  - kube-bench
references: |
  - [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) - Official RBAC documentation
  - [RBAC Good Practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/) - Kubernetes RBAC best practices
---

Role-Based Access Control (RBAC) is the primary authorization mechanism in Kubernetes. Implementing RBAC with the principle of least privilege is essential for cluster security.

## Understanding Kubernetes RBAC

RBAC uses four main objects:

| Object | Scope | Description |
|--------|-------|-------------|
| **Role** | Namespace | Defines permissions within a namespace |
| **ClusterRole** | Cluster | Defines permissions cluster-wide |
| **RoleBinding** | Namespace | Grants Role permissions to subjects |
| **ClusterRoleBinding** | Cluster | Grants ClusterRole permissions cluster-wide |

## The Principle of Least Privilege

Grant only the minimum permissions necessary to perform a task:

1. **Minimize scope** - Use Roles over ClusterRoles when possible
2. **Specific resources** - Limit to specific resource types
3. **Named resources** - Restrict to specific resource instances
4. **Limited verbs** - Only grant necessary actions (get, list, create, etc.)

## Creating Roles

### Namespace-Scoped Role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
```

### Limiting to Specific Resources

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: configmap-updater
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config", "feature-flags"]
  verbs: ["get", "update"]
```

## Creating Bindings

### RoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: development
subjects:
- kind: User
  name: developer@example.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### Binding to Service Account

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-configmap-access
  namespace: production
subjects:
- kind: ServiceAccount
  name: myapp-sa
  namespace: production
roleRef:
  kind: Role
  name: configmap-updater
  apiGroup: rbac.authorization.k8s.io
```

## Common RBAC Patterns

### Read-Only Access

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: namespace-viewer
  namespace: production
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
```

### Developer Access

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "pods/exec"]
  verbs: ["get", "list", "watch", "create", "delete"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "create", "update", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "create", "update", "delete"]
```

### CI/CD Pipeline Access

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: production
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "patch", "update"]
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "create", "update"]
```

## Auditing RBAC

### Check User Permissions

```bash
# Can a user perform an action?
kubectl auth can-i get pods --as developer@example.com -n production

# List all permissions for a user
kubectl auth can-i --list --as developer@example.com -n production
```

### Find Risky Permissions

```bash
# Find ClusterRoleBindings with cluster-admin
kubectl get clusterrolebindings -o json | jq '.items[] | select(.roleRef.name=="cluster-admin")'

# List all subjects with secrets access
kubectl auth can-i get secrets --list --all-namespaces
```

### Review Service Account Permissions

```bash
# Get role bindings for a service account
kubectl get rolebindings,clusterrolebindings -A -o json | \
  jq '.items[] | select(.subjects[]?.name=="default")'
```

## RBAC Anti-Patterns

### What to Avoid

1. **Using cluster-admin for applications**
   ```yaml
   # DON'T DO THIS
   roleRef:
     kind: ClusterRole
     name: cluster-admin
   ```

2. **Wildcard permissions**
   ```yaml
   # DON'T DO THIS
   rules:
   - apiGroups: ["*"]
     resources: ["*"]
     verbs: ["*"]
   ```

3. **Binding to default service accounts**
   ```yaml
   # DON'T DO THIS
   subjects:
   - kind: ServiceAccount
     name: default
   ```

## Best Practices

1. **Create dedicated service accounts** for each application
2. **Use namespace isolation** with namespaced Roles
3. **Avoid ClusterRoleBindings** unless absolutely necessary
4. **Review permissions regularly** using kubectl auth can-i
5. **Use resourceNames** to limit access to specific resources
6. **Document all roles** with clear descriptions
7. **Implement break-glass procedures** for emergency access
