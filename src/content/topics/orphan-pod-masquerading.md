---
title: Orphan Pod Masquerading
description: How attackers create pods that mimic legitimate naming conventions to evade detection
category: offensive
impact: Malicious pods blend in with legitimate workloads, making manual inspection and incident response more difficult
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

When attackers gain the ability to create pods in a cluster, they often try to make malicious workloads blend in with legitimate ones. By mimicking the naming conventions used by Kubernetes controllers, a malicious pod can avoid raising suspicion during manual inspection.

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

## Detecting via Owner References

The key difference between a legitimate Pod and a manually created one is the **.metadata.ownerReferences** field. Pods created by a **ReplicaSet** have an owner reference pointing back to that ReplicaSet:

```bash
kubectl get pod nginx-5d6f7b8c9-x4k2m -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}'
```

```output
ReplicaSet/nginx-5d6f7b8c9
```

A manually created malicious Pod will have **no owner references**:

```bash
kubectl get pod nginx-5d6f7b8c9-m4l1c -o jsonpath='{.metadata.ownerReferences}'
```

The command returns empty or null because the Pod was created directly without a controller. This is the key indicator that distinguishes a spoofed Pod from a legitimate one.

To list all Pods without owner references:

```bash
kubectl get pods -A -o json | jq -r '
  .items[] | 
  select(.metadata.ownerReferences == null) | 
  "\(.metadata.namespace)/\(.metadata.name)"
'
```

## DaemonSet Naming

**DaemonSets** create Pods directly without an intermediate **ReplicaSet**, making them another target for spoofing. Since DaemonSets run one Pod per node, an attacker might create a fake **DaemonSet** pod to blend in with system-level workloads like log collectors or monitoring agents. The naming pattern is **[daemonset-name]-[random]**:

```
fluentd-x7k9m
  │       │
  │       └── Random 5-character suffix
  └── DaemonSet name
```

The owner reference points directly to the DaemonSet:

```bash
kubectl get pod fluentd-x7k9m -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}'
```

```output
DaemonSet/fluentd
```

## Limitations

Finding pods without owner references does not always indicate malicious activity. Legitimate orphan pods exist in these cases:

- Pods created directly using kubectl run with `--restart=Never` for debugging or one-time tasks
- Pods created directly from pod manifests using `kubectl create -f pod.yaml` for testing or specific workloads