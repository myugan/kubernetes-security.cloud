---
title: Internal Cluster Discovery
description: Techniques for discovering available services, APIs, and potential attack vectors within a Kubernetes cluster
category: offensive
createdAt: 2026-01-13
impact: Reveals exposed APIs, misconfigurations, and internal services that can be leveraged for Lateral Movement
mitigation:
  - "Implement network policies to restrict pod-to-pod communication, please refer to [K07: Missing Network Segmentation Controls](https://github.com/OWASP/www-project-kubernetes-top-ten/blob/main/2022/en/src/K07-network-segmentation.md)"
  - Block access to cloud metadata endpoints
  - Use runtime security to detect reconnaissance activity
mitreTechniques:
  - T1046
  - T1613
tools:
  - kube-hunter
references: |
  - [Access Clusters Using the Kubernetes API](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-api/)
---

After gaining initial access to a pod, the first step is reconnaissance. This involves discovering what services, APIs, and resources are accessible from within the cluster to identify potential paths for Lateral Movement and Privilege Escalation.

From a compromised pod, manual reconnaissance with built-in tools tends to be the most reliable. Most container images come with basic networking utilities, or you can fall back on shell built-ins.

### Discovering Kubernetes Version

Identifying the Kubernetes version is part of gathering information that may be useful for further actions. The `/version` endpoint is often accessible without authentication and reveals detailed version information.

```bash
curl -k https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}/version
```

```output
{
  "major": "1",
  "minor": "33",
  "emulationMajor": "1",
  "emulationMinor": "33",
  "minCompatibilityMajor": "1",
  "minCompatibilityMinor": "32",
  "gitVersion": "v1.33.5-gke.2019000",
  "gitCommit": "f9258cc6e54c0405e3519fa292c8287dddf0cf2d",
  "gitTreeState": "clean",
  "buildDate": "2025-12-01T04:21:38Z",
  "goVersion": "go1.24.6 X:boringcrypto",
  "compiler": "gc",
  "platform": "linux/amd64"
}
```

> [!NOTE]
> The `gitVersion` field can reveal the cloud provider, such as `gke` for Google Kubernetes Engine or `eks` for Amazon EKS.

Knowing the exact Kubernetes version allows attackers to search for known CVEs and exploits specific to that version.

### Discovering the API Server

The Kubernetes API server address is automatically injected into every pod through environment variables:

```bash
env | grep KUBERNETES
```

```output
KUBERNETES_SERVICE_PORT_HTTPS=443
KUBERNETES_SERVICE_PORT=443
...[SNIP]...
KUBERNETES_PORT_443_TCP
...[SNIP]...
KUBERNETES_PORT_443_TCP_PROTO=tcp
KUBERNETES_PORT_443_TCP_ADDR=10.109.0.1
KUBERNETES_SERVICE_HOST=10.109.0.1
KUBERNETES_PORT=tcp://10.109.0.1:443
KUBERNETES_PORT_443_TCP_PORT=443
...[SNIP]...
```

### Discovering Other Pod Services

This technique is completely passive and generates no network traffic. Kubernetes automatically injects environment variables for every service in the same namespace at pod creation time. Since this only reads local environment variables, it cannot be detected by network monitoring or intrusion detection systems, unless runtime security tools are monitoring for suspicious command execution.

The naming pattern follows **{SERVICENAME}_SERVICE_HOST** and **{SERVICENAME}_SERVICE_PORT**:

```bash
env | grep _SERVICE_
```

```output
REDIS_SERVICE_HOST=10.109.0.45
REDIS_SERVICE_PORT=6379
MYSQL_SERVICE_HOST=10.109.0.82
MYSQL_SERVICE_PORT=3306
BACKEND_API_SERVICE_HOST=10.109.0.120
BACKEND_API_SERVICE_PORT=8080
KUBERNETES_SERVICE_HOST=10.109.0.1
KUBERNETES_SERVICE_PORT=443
```

Each service exposes additional environment variables with below details:

| Pattern | Description |
|---------|-------------|
| `{NAME}_SERVICE_HOST` | ClusterIP address of the service |
| `{NAME}_SERVICE_PORT` | Primary port of the service |
| `{NAME}_PORT` | Full URL (e.g., tcp://10.109.0.45:6379) |
| `{NAME}_PORT_{PORT}_TCP_ADDR` | IP address for specific port |
| `{NAME}_PORT_{PORT}_TCP_PORT` | Port number |
| `{NAME}_PORT_{PORT}_TCP_PROTO` | Protocol (tcp/udp) |

This reveals internal services that may be interesting targets such as databases (mysql, postgres, redis, mongodb), message queues (rabbitmq, kafka), and internal APIs.

## Automated Reconnaissance

**kube-hunter** simplifies the reconnaissance process by automatically discovering Kubernetes components and checking for common misconfigurations. Rather than manually probing each endpoint, the tool scans for exposed APIs, weak authentication settings, and other security issues in a single run.

> [!NOTE]
> The tool requires Python and pip to install, which can be challenging in containerized environments where minimal images typically lack Python.

## What to Look For

During reconnaissance, prioritize discovering:

1. **Cross-namespace services** in privileged namespaces like **kube-system** may expose dashboards or monitoring tools.
2. **Cloud metadata endpoints** can expose IAM credentials for lateral movement to cloud resources.
3. **Overly permissive service accounts** with broad RBAC permissions that can be used for privilege escalation.
4. **Exposed internal services** such as databases, caches, or message queues that may lack authentication within the cluster network.