---
title: Blocking Privileged Container Deployments
description: Using Pod Security Standards to prevent privileged containers in your cluster
category: offensive
impact: Critical - Privileged containers have full access to the host kernel, enabling complete host compromise, data theft, and lateral movement across the cluster
mitigation: Never run containers in privileged mode unless absolutely necessary, use Pod Security Standards to block privileged pods, implement Seccomp and AppArmor profiles, and drop all unnecessary Linux capabilities
mitreTechniques:
  - T1611
  - T1610
  - T1053
tools:
  - kube-bench
  - falco
  - trivy
references: |
  - [Kubernetes Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) - Official documentation on configuring security contexts
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) - Kubernetes Pod Security Standards
  - [Linux Capabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html) - Understanding Linux capabilities
---

Privileged containers are one of the most dangerous misconfigurations in Kubernetes. This topic explains what privileged containers are, why they're dangerous, and how attackers exploit them.

## What Is a Privileged Container?

Privileged containers are containers that have all Linux capabilities enabled. By default, Docker containers run as root users with certain capabilities but not all of them. A privileged container disables namespace isolation, grants all capabilities, and exposes the host's devices through `/dev`, making the system insecure by default.

## Security Context in Kubernetes

The `securityContext` field in Kubernetes defines privilege and access control settings for a Pod or container. Key settings include:

| Setting | Description |
|---------|-------------|
| `runAsUser` | Specifies the UID with which each container will run |
| `runAsNonRoot` | Forces the container to run as a non-root user |
| `privileged` | Runs the container with all host capabilities |
| `allowPrivilegeEscalation` | Controls whether processes can gain more privileges |
| `capabilities` | Controls Linux capabilities that can be added or dropped |
| `readOnlyRootFilesystem` | Mounts the container root filesystem as read-only |

## How Attackers Exploit Privileged Containers

### Modifying Host Kernel Parameters

A privileged container can modify kernel parameters on the host:

```bash
# Inside a privileged container
echo 0 > /proc/sys/vm/numa_stat
sysctl kernel.hostname=compromised
```

### Accessing Host Devices

Privileged containers can access all host devices through `/dev`:

```bash
# Mount the host filesystem
mount /dev/sda1 /mnt
ls /mnt  # Access host files
```

### Escaping to the Host

With full capabilities, an attacker can escape the container entirely and execute commands on the host system.

## Detecting Privileged Containers

Check if a container is running in privileged mode:

```bash
# Check Seccomp status (0 means no restrictions)
grep Seccomp /proc/1/status

# List all capabilities
capsh --print
```

## Defensive Measures

1. **Never use privileged mode** unless absolutely necessary
2. **Use Pod Security Standards** to enforce restrictions
3. **Drop all capabilities** and add only what's needed
4. **Implement Seccomp profiles** to restrict system calls
5. **Use AppArmor or SELinux** for mandatory access control
6. **Monitor with Falco** for runtime detection

## Secure Container Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  containers:
  - name: app
    image: myapp:latest
    securityContext:
      privileged: false
      runAsNonRoot: true
      runAsUser: 1000
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```
