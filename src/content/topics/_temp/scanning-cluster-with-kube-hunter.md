---
title: Cluster Reconnaissance
description: Scanning Kubernetes clusters to discover security weaknesses, exposed services, and potential attack vectors
category: offensive
impact: High - Reveals exposed APIs, misconfigurations, and potential attack vectors visible to attackers
mitigation: Run kube-hunter regularly in passive mode, fix identified issues, and re-scan to verify remediation
mitreTechniques:
  - T1046
  - T1595
tools:
  - kube-hunter
references: |
  - [kube-hunter GitHub](https://github.com/aquasecurity/kube-hunter) - Official repository with documentation
  - [Aqua Security Blog](https://blog.aquasec.com/kube-hunter-kubernetes-penetration-testing) - Kubernetes penetration testing with kube-hunter
---

kube-hunter is a security tool that hunts for security weaknesses in Kubernetes clusters. Developed by Aqua Security, it provides an attacker's perspective of your cluster.

## Deployment Options

There are three ways to run kube-hunter:

1. **On a machine** with access to the cluster - provides external attacker's view
2. **As a Docker container** - portable scanning option
3. **As a Pod** within the cluster - simulates compromised application pod

## Scanning Modes

### Passive Hunting

Reconnaissance without altering cluster state:

- K8s API services detection
- Dashboard discovery
- etcd service identification
- Kubelet service detection
- Service enumeration

```bash
# Install kube-hunter
pip3 install kube-hunter

# Run passive scan against remote cluster
kube-hunter --remote <cluster-ip>
```

### Active Hunting

More intrusive testing that may alter state:

```bash
# Run active scan (use with caution)
kube-hunter --remote <cluster-ip> --active
```

Active hunting includes:
- Kubelet exploitation attempts
- Container log retrieval
- Pod execution tests

## Running as a Pod

Deploy kube-hunter inside the cluster to test internal exposure:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-hunter
spec:
  containers:
  - name: kube-hunter
    image: aquasec/kube-hunter:latest
    command: ["kube-hunter"]
    args: ["--pod"]
  restartPolicy: Never
```

## Interpreting Results

kube-hunter reports findings by severity:

| Severity | Description |
|----------|-------------|
| Critical | Immediate exploitation possible |
| High | Significant security weakness |
| Medium | Potential attack vector |
| Low | Informational finding |

## Common Findings

- Anonymous Kubelet API access
- Exposed Kubernetes Dashboard
- etcd accessible without authentication
- API Server anonymous access enabled
- Missing network policies
