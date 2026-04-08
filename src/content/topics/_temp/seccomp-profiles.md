---
title: Blocking Dangerous Syscalls with Seccomp
description: Creating and applying Seccomp profiles to restrict container capabilities
category: defensive
impact: Significant risk reduction - Seccomp profiles prevent containers from making dangerous system calls, limiting the impact of container compromise
mitigation: Apply Seccomp profiles to all workloads, use the RuntimeDefault profile as a baseline, create custom profiles for sensitive workloads, and monitor for blocked syscalls
mitreTechniques:
  - T1059
  - T1611
  - T1068
tools:
  - kubectl
  - kube-bench
references: |
  - [Seccomp Security Profiles](https://kubernetes.io/docs/tutorials/security/seccomp/) - Official Kubernetes Seccomp documentation
  - [Security Profiles Operator](https://github.com/kubernetes-sigs/security-profiles-operator) - Kubernetes operator for managing security profiles
---

Seccomp (Secure Computing Mode) is a Linux kernel feature that restricts the system calls a process can make. In Kubernetes, Seccomp profiles are used to limit what containers can do at the kernel level.

## Understanding Seccomp

Seccomp operates in two modes:

1. **Strict mode** - Only allows read, write, exit, and sigreturn
2. **Filter mode** - Allows defining custom rules using BPF filters

In Kubernetes, we use filter mode with profile files that define which syscalls are allowed.

## Why Seccomp Matters

Without Seccomp, a container can make any system call, including dangerous ones like:

- `mount` - Mount filesystems
- `ptrace` - Trace and control processes
- `reboot` - Reboot the system
- `init_module` - Load kernel modules

## Checking Seccomp Status

Inside a container, check if Seccomp is enabled:

```bash
grep Seccomp /proc/1/status
```

Output meanings:
- `0` - Seccomp disabled (dangerous)
- `1` - Strict mode
- `2` - Filter mode (recommended)

## Seccomp Profiles in Kubernetes

### RuntimeDefault Profile

The easiest way to enable Seccomp is using the RuntimeDefault profile:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:latest
```

### Localhost Profile

Use custom profiles stored on nodes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-seccomp-pod
spec:
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/custom-profile.json
  containers:
  - name: app
    image: myapp:latest
```

## Creating Custom Profiles

### Profile Structure

A Seccomp profile is a JSON file:

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": ["read", "write", "exit", "exit_group"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": ["mount", "ptrace", "reboot"],
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
```

### Actions

| Action | Description |
|--------|-------------|
| `SCMP_ACT_ALLOW` | Allow the syscall |
| `SCMP_ACT_ERRNO` | Return an error (EPERM) |
| `SCMP_ACT_KILL` | Kill the process |
| `SCMP_ACT_LOG` | Log and allow (for auditing) |

### Generating Profiles

Use tools to generate profiles based on application behavior:

```bash
# Using strace to identify syscalls
strace -c -f your-application

# Using OCI runtime to record syscalls
# The Security Profiles Operator can help automate this
```

## Security Profiles Operator

The Security Profiles Operator simplifies Seccomp management:

### Installation

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/security-profiles-operator/main/deploy/operator.yaml
```

### Create a Profile

```yaml
apiVersion: security-profiles-operator.x-k8s.io/v1beta1
kind: SeccompProfile
metadata:
  name: my-app-profile
  namespace: default
spec:
  defaultAction: SCMP_ACT_ERRNO
  syscalls:
  - action: SCMP_ACT_ALLOW
    names:
    - read
    - write
    - open
    - close
    - exit_group
```

### Profile Recording

Automatically generate profiles by recording application behavior:

```yaml
apiVersion: security-profiles-operator.x-k8s.io/v1alpha1
kind: ProfileRecording
metadata:
  name: my-app-recording
spec:
  kind: SeccompProfile
  recorder: logs
  podSelector:
    matchLabels:
      app: my-app
```

## Enforcement with Pod Security Standards

Require Seccomp profiles at the namespace level:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: secure-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
```

## Troubleshooting

### Debugging Blocked Syscalls

When syscalls are blocked, containers may fail. Debug with:

```bash
# Check container logs
kubectl logs problematic-pod

# Use audit mode first
# Set defaultAction to SCMP_ACT_LOG to identify required syscalls
```

### Common Issues

1. **Container won't start** - Required syscall blocked
2. **Application crashes** - Missing syscall permissions
3. **Network issues** - socket/connect syscalls blocked

## Best Practices

1. **Start with RuntimeDefault** - Provides good baseline security
2. **Test in non-production** - Verify profiles don't break applications
3. **Use audit mode** - Log blocked syscalls before enforcing
4. **Automate profile generation** - Use Security Profiles Operator
5. **Apply to all workloads** - Consistent security posture
