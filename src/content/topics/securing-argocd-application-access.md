---
title: Securing ArgoCD Application Access
description: Restrict ArgoCD RBAC, enforce AppProject boundaries, and block privileged workload deployment through the ArgoCD confused deputy attack path
category: defensive
createdAt: 2026-04-20
impact: >-
  Without these controls, any user with applications create permission in ArgoCD can deploy privileged workloads cluster-wide using ArgoCD's own service account, bypassing Kubernetes RBAC entirely. With these controls, Application creation is scoped to trusted repositories and namespaces, and the resources those Applications can deploy are limited to an explicit allowlist.
mitigation:
  - Scope **applications create** in ArgoCD RBAC to specific AppProjects rather than wildcard. Never grant create on the default project without an AppProject that enforces source and destination restrictions.
  - Use **AppProject** to enforce source repository allowlists, destination namespace and cluster restrictions, and cluster resource whitelists. An Application that references a repository or destination not in the AppProject is rejected by ArgoCD before sync.
  - Alert on **Application creation events** in the Kubernetes audit log that reference repositories outside the approved list, or that target namespaces where privileged workloads are unexpected.
references: |
  - [ArgoCD RBAC Configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
  - [ArgoCD AppProject Documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
---

ArgoCD's application controller service account holds broad cluster permissions to reconcile any resource across the cluster. When a user creates an `Application` object, ArgoCD reads the desired state from a Git repository and applies it using its own credentials, not the user's. The user's Kubernetes RBAC is never checked against the resources inside the manifest. This makes `applications create` in ArgoCD RBAC equivalent to delegated cluster-admin for whatever the manifest contains.

Two controls work together to close this: ArgoCD RBAC scoping limits who can create Applications and in which projects, and AppProject boundaries restrict what those Applications can deploy and from where.

## Scoping ArgoCD RBAC

ArgoCD RBAC is configured in the `argocd-rbac-cm` ConfigMap in the `argocd` namespace. The default policy grants the built-in `role:readonly` to authenticated users and `role:admin` to members of the configured admin group. The built-in `role:admin` includes `applications, create, */*, allow`, which is a wildcard across all projects and namespaces.

Replacing that with explicit project-scoped grants prevents users from creating Applications in the `default` project or any project without a matching grant:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:app-deployer, applications, create, logging/*, allow
    p, role:app-deployer, applications, sync,   logging/*, allow
    p, role:app-deployer, applications, get,    logging/*, allow

    g, platform-team, role:admin
    g, app-team,      role:app-deployer
```

The `logging/*` scope means members of `app-team` can create Applications only in the `logging` AppProject. They cannot create Applications in `default` or any other project. The `role:readonly` default policy gives all authenticated users read-only access without any create or sync capability.

Check what the current effective policy grants before making changes:

```bash
kubectl -n argocd get configmap argocd-rbac-cm -o yaml
```

## Enforcing AppProject Boundaries

ArgoCD RBAC scoping is a necessary first step, but it only restricts who can create Applications in a project. AppProject is where you define what those Applications are allowed to do: which repositories they can pull from, which clusters and namespaces they can deploy into, and which Kubernetes resource types they are allowed to create.

Without an AppProject, the `default` project imposes no restrictions. Any repository URL and any destination namespace is valid.

A locked-down AppProject for a logging team looks like this:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: logging
  namespace: argocd
spec:
  sourceRepos:
    - https://github.com/your-org/helm-charts
  destinations:
    - namespace: logging
      server: https://kubernetes.default.svc
  clusterResourceWhitelist: []
  namespaceResourceWhitelist:
    - group: apps
      kind: DaemonSet
    - group: apps
      kind: Deployment
    - group: ""
      kind: ConfigMap
    - group: ""
      kind: Service
```

Key fields:

- **`sourceRepos`** is an allowlist. ArgoCD rejects any Application in this project that references a repository not in this list. An attacker cannot point to an arbitrary GitHub repository.
- **`destinations`** restricts which clusters and namespaces Applications in this project can deploy into. A destination outside this list is rejected.
- **`clusterResourceWhitelist`** controls which cluster-scoped resources can be created. Setting this to an empty list blocks creation of ClusterRoles, ClusterRoleBindings, and other cluster-scoped resources entirely.
- **`namespaceResourceWhitelist`** controls which namespace-scoped resource types are allowed. A DaemonSet with `hostPID: true` is still a DaemonSet and passes this check. Blocking the specific privileged configurations inside a manifest requires a separate admission control layer such as Pod Security Admission or an OPA policy.

Verify that an Application referencing an unapproved repository is blocked from syncing. ArgoCD does not register a validating webhook for Application objects, so `kubectl apply` succeeds at the API server level. ArgoCD's application controller validates the spec on reconciliation and marks it invalid:

```bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: test-bad-repo
  namespace: argocd
spec:
  project: logging
  source:
    repoURL: https://github.com/attacker-org/helm-charts
    targetRevision: main
    path: charts/filebeat
  destination:
    server: https://kubernetes.default.svc
    namespace: logging
EOF
```

```output
application.argoproj.io/test-bad-repo created
```

The Application object is created but ArgoCD refuses to sync it. The rejection is visible in the status conditions:

```bash
kubectl get application test-bad-repo -n argocd \
  -o jsonpath='{.status.conditions[0].message}'
```

```output
application repo https://github.com/attacker-org/helm-charts is not permitted in project 'logging'
```

The sync status remains `Unknown` and no resources are deployed. An attacker who creates this Application gains nothing: ArgoCD will not reconcile it until the spec is corrected to use an approved repository.

## Detecting Malicious Application Creation

ArgoCD `Application` objects are Kubernetes custom resources in the `argoproj.io` group. Every creation event is recorded in the Kubernetes audit log. The audit policy must log at `Request` level or higher for these resources so the request body (including the repository URL) is available for querying:

An audit policy rule that captures Application and workload creation at the required detail level:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Request
    verbs: ["create", "delete"]
    resources:
      - group: "argoproj.io"
        resources: ["applications"]
  - level: Metadata
    verbs: ["create", "delete"]
    resources:
      - group: "apps"
        resources: ["daemonsets", "deployments"]
```

Parse the audit log for Application creation events and extract the repository URL to check against an approved list:

```bash
logcli query '{job="k8s-audit"} |= "resource":"applications" |= "verb":"create" |= "argoproj.io"' \
  --output=jsonl \
  | jq -r '.line | fromjson | {user: .user.username, name: .objectRef.name, repo: .requestObject.spec.source.repoURL, timestamp: .requestReceivedTimestamp}'
```

```output
{
  "user": "attacker@example.com",
  "name": "filebeat",
  "repo": "https://github.com/attacker-org/helm-charts",
  "timestamp": "2026-04-20T03:01:06.011346Z"
}
```

## Detecting selfHeal Persistence

An attacker who successfully creates a malicious Application with `selfHeal: true` turns deletion of the deployed workload into a trigger for redeployment. A defender who deletes the DaemonSet will see it return within seconds without knowing why.

The signal is a workload being recreated by the `argocd-application-controller` service account shortly after deletion. Check the audit log for the recreating actor:

```bash
logcli query '{job="k8s-audit"} |= "resource":"daemonsets" |= "verb":"create" |= "system:serviceaccount:argocd:argocd-application-controller"' \
  --output=jsonl \
  | jq -r '.line | fromjson | {name: .objectRef.name, namespace: .objectRef.namespace, timestamp: .requestReceivedTimestamp}'
```

If the audit log shows repeated `argocd-application-controller` creates on the same resource after it was deleted, the source is an Application with selfHeal enabled. List all Applications across the cluster to find it:

```bash
kubectl get applications -A
```

```output
NAMESPACE   NAME       SYNC STATUS   HEALTH STATUS
argocd      filebeat   Synced        Healthy
```

Deleting the Application object stops the reconciliation loop:

```bash
kubectl delete application filebeat -n argocd
```

ArgoCD will no longer reconcile the DaemonSet and the selfHeal cycle ends. The existing DaemonSet pods remain until deleted manually. Deleting them is safe once the Application is gone.
