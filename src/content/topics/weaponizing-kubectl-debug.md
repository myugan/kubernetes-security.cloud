---
title: Weaponizing kubectl debug
description: >-
  Why kubectl debug is a privilege escalation path, not just a troubleshooting tool
category: offensive
offensiveType: privilege-escalation
createdAt: 2026-04-05
impact: >-
  Ephemeral debug inherits the pod's network namespace, service account, and volume mounts. Node debug mounts the host filesystem at `/host`, `chroot /host` gives full host root access.
mitigation:
  - Apply the same guardrails to debug flows as you do for privileged or `hostPath` pods (PSA, Kyverno, Gatekeeper), including `pods/ephemeralcontainers` and `pods/create` when they feed into debug.
  - Keep `pods/exec`, `pods/attach`, and `pods/ephemeralcontainers` on tight break-glass roles. Watch audit logs for EphemeralContainer changes and debugger-style pods.
  - Where you can, run setups where tenants never get anything close to node debug. Turn off ephemeral containers if you are not using them.
mitreTechniques:
  - T1611
  - T1552
  - T1078
  - T1059
tools:
  - kubectl
kubernetesVersion: 1.23+
references: |
  - [Debugging Kubernetes nodes with kubectl](https://kubernetes.io/docs/tasks/debug/debug-cluster/kubectl-node-debug/)
  - [Debugging profiles](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#debugging-profiles)
  - [Ephemeral debug container](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#ephemeral-container)
  - [Beyond the Surface (Rory McCune, YouTube)](https://www.youtube.com/watch?v=GtrkIuq5T3M)
---

`kubectl debug` is for break-glass work. You either attach an ephemeral debugger to a pod that is already running, or you start a node debugger whose profile controls how close you get to the host.

## The attack sequence

The attacker uses `kubectl debug` to access running containers or nodes with elevated privileges.

### Step 1: Verify RBAC permissions

Check which debug-related permissions are available:

```bash
kubectl auth can-i get pods
kubectl auth can-i patch pods/ephemeralcontainers
kubectl auth can-i create pods
kubectl auth can-i get nodes
```

## RBAC for kubectl debug access

Use a `ClusterRole` instead if you must list nodes or create debugger pods across more than one namespace.

### 1. Ephemeral containers

You must be able to read the target pod and patch its `pods/ephemeralcontainers` subresource. For an interactive `kubectl debug -it` session you also need attach access on that pod.

Sample `Role` for running ephemeral containers for debugging:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["pods/ephemeralcontainers"]
    verbs: ["patch"]
  - apiGroups: [""]
    resources: ["pods/attach"]
    verbs: ["create", "get"]
```

Replace `<pod-name>`, `<namespace>`, and `<container-name>` with real values.

```bash
kubectl debug -it <pod-name> -n <namespace> --image=busybox:1.36 --target=<container-name>
```

Without `--target`, ephemeral container joins the pod's network namespace but gets its own isolated PID namespace, so you can't see other containers' processes.

With `--target=<container>`, ephemeral container shares that container's PID namespace, so `ps aux` shows the target container's processes. Useful for inspecting what's actually running inside it.

### 2. Node debugging

Node debugging still creates a normal Pod object. `kubectl` fills in the pod spec for you, including host-oriented settings. That generated spec is often very powerful.

For `kubectl debug -it` you typically need `pods/create`, `get`,`list` on pods, `get`,`list` on nodes (to choose a node), and `attach` on the debugger pod.

The exact mounts and capabilities depend on the debug profile and your server version.

```yaml
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "get", "list"]
  - apiGroups: [""]
    resources: ["pods/attach"]
    verbs: ["create", "get"]
```

Replace `<node-name>` with the node you want:

```bash
kubectl debug node/<node-name> -it --image=busybox:1.36 --profile=sysadmin
```

### What `--profile=sysadmin` means

The `--profile` flag picks a built-in template for the debugger pod. That template sets the security context and related fields. It is not a Linux `sysctl` profile.

For `kubectl debug node`, the upstream docs describe the default-style debugger as not privileged, even though it joins the node’s PID, network, and IPC namespaces and mounts `/host`. In that situation `chroot /host` can fail, because the process may still lack the privileges `chroot` needs.

The `sysadmin` profile is the strongest of the standard presets that `kubectl` documents (`legacy`, `general`, `baseline`, `netadmin`, `restricted`, `sysadmin`). If you omit `--profile`, the client default for that flag is `legacy`. Always confirm the real behavior on your cluster against the official [Debugging profiles](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#debugging-profiles) page.

After `kubectl debug node` gives you a shell, move into the host root like this:

```bash
chroot /host /bin/sh
```

The node’s root filesystem is usually mounted inside the debugger pod at `/host`. Running `chroot /host /bin/sh` makes `/` point at the host root, so you see the entire host filesystem.