---
title: Compromising etcd via Pod Creation
description: >-
  Steal etcd TLS via pod hostPath on the control plane
category: offensive
offensiveType: credential-access
createdAt: 2026-04-05
impact: >-
  With etcd TLS material from the control plane’s etcd certificate directory (for example kubeadm’s **server.crt** / **server.key** plus the etcd **CA**), an attacker can authenticate to etcd directly, list and export every Secret and object in the datastore, and in many configurations modify RBAC or persist backdoors. That level of access is often beyond what Kubernetes audit logs attribute to a normal API user.
mitigation:
  - Block or strictly gate **hostPath** mounts with admission policy (OPA Gatekeeper, Kyverno, Pod Security restricted profile where feasible).
  - Prevent untrusted identities from scheduling workloads onto **control plane** nodes (avoid tolerations for control-plane taints, use separate node pools, and restrict **nodes/proxy** or **pods** placement abuse).
  - Prefer **managed Kubernetes** control planes where etcd and PKI are not exposed on customer-accessible nodes.
  - Enable **etcd encryption at rest** and protect **encryption provider** configuration so filesystem access alone does not yield usable Secret plaintext.
  - Restrict host filesystem access on control plane nodes (hardening, minimal SSH, integrity monitoring) and monitor for pods with **hostNetwork**, **hostPID**, and **hostPath** toward `/etc/kubernetes/pki/etcd` or `/var/lib/etcd`.
mitreTechniques:
  - T1610
  - T1611
  - T1552
  - T1078
references: |
  - [PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/)
  - [Operating etcd clusters for Kubernetes](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
  - [etcd security model](https://etcd.io/docs/v3.5/op-guide/security/)
---

This topic is the **next step** after [Weaponizing Pod Creation Access](/topics/weaponizing-pod-creation/). That page shows how **pod create** plus **hostPath** can mount node filesystems, including `/var/lib/etcd` on stacked control plane nodes, to read raw member data. Here the **hostPath** is limited to the **etcd PKI directory only** (`/etc/kubernetes/pki/etcd` on typical kubeadm clusters), not the rest of `/etc/kubernetes/pki`. You copy **etcd’s CA** and a TLS keypair under that directory that etcd will accept as a client (kubeadm commonly exposes **`server.crt`** and **`server.key`** there), combine that with **hostNetwork** on the same machine as **etcd**, and use **etcdctl** to speak to **etcd** over mutual TLS. That still yields **live** reads (and, depending on etcd configuration and file permissions, writes) against the entire Kubernetes object store.

> [!NOTE]
> This applies to clusters where **etcd** runs on (or is reachable from) nodes you can schedule onto, for example with **stacked etcd** on control plane VMs. On **GKE, EKS, AKS**, and similar offerings, the control plane and etcd are **not** customer-schedulable. These paths do not apply in the same way.

## Why etcd client certificates matter

The Kubernetes API server persists every **Secret**, **ConfigMap**, **ServiceAccount** token backing store entry, **RoleBinding**, and more under `/registry/...` keys in **etcd**. If you can authenticate to **etcd** with credentials trusted by the server, you can **dump or tamper with cluster state** without going through the audited API surface. You can also bypass admission layers that only run on API requests.

Reading **etcd** data files from disk (as in the `/var/lib/etcd` **hostPath** example) is one approach. Another is to **mount only the etcd certificate directory** and use material that etcd trusts for **client** authentication:

- **etcd CA** (to validate the etcd server): `/etc/kubernetes/pki/etcd/ca.crt` on the host (mounted into the pod)
- **Client cert and key** in the same directory: on **kubeadm** clusters the example below uses **`server.crt`** and **`server.key`** (the same directory also holds **`peer.crt`**, **`ca.crt`**, and related etcd material)

The **kube-apiserver** also uses **`apiserver-etcd-client.crt`** and **`apiserver-etcd-client.key`**, but those files sit in the **parent** folder **`/etc/kubernetes/pki/`**, not inside **`etcd/`**. This walkthrough keeps the **hostPath** scoped to **`/etc/kubernetes/pki/etcd`** so you are not mounting the full cluster PKI (service account signing keys, front-proxy certs, and so on). Paths and filenames can differ if your distribution customized the control plane layout. See the upstream [certificates documentation](https://kubernetes.io/docs/setup/best-practices/certificates/).

## The attack sequence

The attacker creates a pod on a control plane node, mounts the etcd PKI directory, and uses the certificates to authenticate directly to etcd.

### Step 1: Verify prerequisites

1. **Permission to create pods** (or workloads that become pods) in a namespace that allows the dangerous fields you need.
2. A **control plane node** you can schedule onto, typically via **nodeSelector** / **affinity** and **tolerations** for `node-role.kubernetes.io/control-plane` (or legacy `master`) **NoSchedule** taints, as shown in [Weaponizing Pod Creation Access](/topics/weaponizing-pod-creation/).
3. The cluster is **not** one where the control plane is fully **managed** and isolated from your workloads.

If you only have pod creation in a worker-only pool, you may still pivot using **hostPath** on workers (kubelet credentials, cloud metadata, etc.), but **etcd** keys are not on workers in a normal architecture. The **etcd** angle is **control plane** specific.

The idea is to land on a **control plane** host, mount **only** the **etcd TLS directory** read-only, and share the node’s network namespace so **127.0.0.1:2379** is the same **etcd** endpoint used for **stacked etcd**.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: etcd-pki-client
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-role.kubernetes.io/control-plane
                operator: Exists
  tolerations:
    - key: node-role.kubernetes.io/control-plane
      operator: Exists
      effect: NoSchedule
  containers:
    - name: tools
      image: bitnamilegacy/etcd:3.6.4
      command: ["/bin/sh", "-c", "sleep infinity"]
      securityContext:
        runAsUser: 0
      volumeMounts:
        - name: etcd-pki
          mountPath: /etcd-pki
          readOnly: true
  volumes:
    - name: etcd-pki
      hostPath:
        path: /etc/kubernetes/pki/etcd
        type: Directory
```

> [!TIP]
> The image **`bitnamilegacy/etcd:3.6.4`** is a convenience choice: it includes **`etcdctl`** and a real shell (**`/bin/sh`**), so **`kubectl exec`** works the way the steps below expect. Many upstream **etcd** images are minimal or distroless and do not ship an interactive shell.

**hostNetwork: true** is what makes `https://127.0.0.1:2379` (typical for local **etcd** on the control plane) reachable from the pod’s network namespace. **dnsPolicy: ClusterFirstWithHostNet** keeps in-cluster DNS usable if you also need Kubernetes API access from the same pod.

Scheduling uses **node affinity** so the pod can land on a node labeled **`node-role.kubernetes.io/control-plane`**, with a **toleration** for the control-plane **NoSchedule** taint.

## Using etcdctl with the mounted etcd certificates

Exec into the pod and call **etcdctl** using files under **`/etcd-pki`**. The example uses **`ca.crt`** as the trust anchor and **`server.crt`** with **`server.key`** as the TLS client identity. If your cluster layout differs, map whatever keypair your installer placed under the etcd PKI directory (still without mounting the whole **`/etc/kubernetes/pki`** tree if you want to stay scoped to etcd).

```bash
kubectl exec -it etcd-pki-client -- sh
```

```bash
export ETCDCTL_API=3
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etcd-pki/ca.crt \
  --cert=/etcd-pki/server.crt \
  --key=/etcd-pki/server.key \
  get /registry/secrets --prefix --keys-only | head
```

From here, an attacker can **export sensitive objects**, hunt for **cluster-admin** equivalent bindings stored as **Kubernetes** objects, or, if their access is not read-only at the **etcd** layer, attempt **writes**. Even read-only **etcd** access is often enough for **full confidentiality breach** because **Secrets** live in the datastore. For background on what **etcd** stores and why it matters, see the [etcd glossary entry](/glossary/etcd/).