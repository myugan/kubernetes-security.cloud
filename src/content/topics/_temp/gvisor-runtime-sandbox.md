---
title: Isolating Untrusted Workloads with gVisor
description: Running containers in a sandboxed kernel to prevent host kernel exploitation
category: defensive
impact: Critical - Provides kernel-level isolation preventing container escapes from reaching the host kernel
mitigation: Deploy gVisor for untrusted workloads, configure RuntimeClass, and test application compatibility
mitreTechniques:
  - T1611
  - T1068
tools:
  - kubectl
references: |
  - [gVisor Documentation](https://gvisor.dev/docs/) - Official gVisor docs
  - [GKE Sandbox](https://cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods) - gVisor in Google Kubernetes Engine
---

gVisor is an application kernel that provides an additional layer of isolation between containers and the host kernel. It intercepts system calls from containers, preventing direct access to the host.

## How gVisor Works

Traditional containers share the host kernel directly. gVisor provides:

1. **Sentry** - User-space kernel that handles system calls
2. **Gofer** - File system proxy for controlled I/O
3. **runsc** - OCI runtime that integrates with containerd

## Why Use gVisor

| Traditional Runtime | gVisor |
|---------------------|--------|
| Direct kernel access | Intercepted syscalls |
| Kernel vulnerabilities exposed | Limited attack surface |
| Fast performance | Some overhead |
| Full syscall compatibility | Some syscalls unsupported |

## Installation

```bash
# Install runsc
wget https://storage.googleapis.com/gvisor/releases/release/latest/x86_64/runsc
chmod +x runsc
sudo mv runsc /usr/local/bin/

# Configure containerd
cat >> /etc/containerd/config.toml << EOF
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
EOF

sudo systemctl restart containerd
```

## RuntimeClass Configuration

Create a RuntimeClass for gVisor:

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
```

## Using gVisor for Pods

Specify the RuntimeClass in pod spec:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandboxed-app
spec:
  runtimeClassName: gvisor
  containers:
  - name: app
    image: nginx:latest
```

## Verifying gVisor is Active

```bash
# Check if running under gVisor
kubectl exec sandboxed-app -- dmesg | head
# Should show "Starting gVisor"

# Check /proc
kubectl exec sandboxed-app -- cat /proc/version
# Shows gVisor version, not host kernel
```

## Use Cases

- Running untrusted code
- Multi-tenant clusters
- Processing user uploads
- CI/CD build containers
- Compliance requirements

## Limitations

Some applications may not work with gVisor:
- Applications requiring direct hardware access
- Some network-intensive workloads
- Applications using unsupported syscalls

Test thoroughly before production deployment.
