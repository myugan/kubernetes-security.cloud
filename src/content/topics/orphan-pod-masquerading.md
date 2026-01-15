---
title: Orphan Pod Masquerading
description: Creating orphan pods that mimic controller-managed naming conventions to blend in with legitimate workloads
category: offensive
impact: Orphan pods disguised as controller-managed workloads can evade casual inspection and complicate incident response
mitigation:
  - Verify pod ownership using `.metadata.ownerReferences`
  - Monitor for pods without valid owner references
mitreTechniques:
  - T1036
references: |
  - [Owners and Dependents](https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/)
  - [Why Kubernetes Compares With Hash](https://maelvls.dev/do-not-share-yet/why-kubernetes-compares-with-hash/)
  - [ComputeHash Source Code](https://github.com/kubernetes/kubernetes/blob/master/pkg/controller/controller_utils.go#L1395) - Where **pod-template-hash** is generated
---

An orphan pod is a pod without an owner reference, meaning it was created directly rather than by a controller like a **Deployment** or **DaemonSet**. Attackers can exploit this by creating orphan pods that mimic the naming conventions of controller-managed pods, making malicious workloads blend in during casual inspection.

When a **Deployment** is created, Kubernetes generates a **ReplicaSet** with a **pod-template-hash**, then the **ReplicaSet** creates Pods. The hash is computed using the **32-bit FNV-1** against the **PodTemplateSpec**, then encoded using `SafeEncodeString` to produce a 9-10 character alphanumeric string. The resulting Pod name follows the pattern **[deployment-name]-[hash]-[random]**:

```
nginx-5d6f7b8c9-x4k2m
  │      │       │
  │      │       └── Random 5-character suffix
  │      └── Pod template hash (from ReplicaSet)
  └── Deployment name
```

The **pod-template-hash** is stored in **.metadata.labels.pod-template-hash**:

```bash
kubectl get pod nginx-5d6f7b8c9-x4k2m -o jsonpath='{.metadata.labels.pod-template-hash}'
```

```output
5d6f7b8c9
```

An attacker can manually create a Pod that mimics this naming pattern:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-5d6f7b8c9-m4l1c
  labels:
    app: nginx
    pod-template-hash: 5d6f7b8c9
spec:
  containers:
    - name: nginx
      image: malicious
```

At first glance, this Pod appears to belong to the nginx Deployment. The name follows the expected pattern, and the labels match what you'd expect from a legitimate Pod. During a quick `kubectl get pods` review, this malicious Pod would blend in with the other nginx replicas, making it difficult to identify without deeper inspection.

## DaemonSet Naming

**DaemonSets** create Pods directly without an intermediate **ReplicaSet**, making them another target for spoofing. Since DaemonSets run one Pod per node, an attacker might create a fake **DaemonSet** pod to blend in with system-level workloads like log collectors or monitoring agents. The naming pattern is **[daemonset-name]-[random]**:

```
fluentd-x7k9m
  │       │
  │       └── Random 5-character suffix
  └── DaemonSet name
```

An attacker can create an orphan pod mimicking this pattern to blend in with monitoring or logging infrastructure that typically runs as DaemonSets.

## Legitimate Orphan Pods

Not all orphan pods are malicious. Legitimate orphan pods exist in these cases:

- Pods created directly using kubectl run with `--restart=Never` for debugging or one-time tasks
- Pods created directly from pod manifests using `kubectl create -f pod.yaml` for testing or specific workloads