---
title: Detecting Orphan Pod Masquerading via Audit Logs
description: Identifying pods that mimic controller-managed naming patterns but were created directly by a user rather than a controller
category: defensive
createdAt: 2026-04-12
impact: Surfaces masquerading pods planted by attackers that blend in with Deployment or DaemonSet workloads. A pod with a controller-like name but no ownerReferences and a human user as its creator is a reliable indicator of the orphan pod masquerading technique.
mitigation:
  - Monitor the API server audit log for pod create events where the user is not a known controller service account such as replicaset-controller, daemonset-controller, or job-controller
  - Cross-reference any flagged pod name against the naming pattern of existing controllers in the same namespace to determine if masquerading was attempted
  - Confirm the finding by checking the pod's ownerReferences, which will be absent on an orphan pod regardless of how convincing its name looks
references: |
  - [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
  - [Orphan Pod Masquerading](/topics/orphan-pod-masquerading)
---

Pods in a Kubernetes cluster are normally created by controllers. A Deployment creates pods through a ReplicaSet, a DaemonSet creates them directly, a Job spawns them for each task. In all cases, the controller's service account appears as the creator in the API server audit log and the pod carries an `ownerReferences` field linking it back to its parent.

An attacker using orphan pod masquerading creates a pod directly, copying the naming pattern of a real controller-managed workload. The pod looks identical in `kubectl get pods` output but has no controller behind it. The audit log exposes this because the creator is a human user or arbitrary service account, not a controller. That signal is available the moment the pod is created, before any inspection of the pod itself.

## What the Audit Log Reveals

Every pod creation produces a `ResponseComplete` audit event. The `user.username` field tells you who issued the create call. Two additional fields help narrow the investigation:

- **`userAgent`**: controller-managed pods show a `kube-controller-manager` agent. A directly created pod shows `kubectl` or another client tool.
- **`requestURI`**: a direct pod creation via `kubectl apply` includes `fieldManager=kubectl-client-side-apply` in the query string. Controller-created pods do not.

For a pod created by a Deployment scaling up, the audit event looks like this:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "e672a0e2-c487-4c66-a30b-4609281f1a88",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods",
  "verb": "create",
  "user": {
    "username": "system:serviceaccount:kube-system:replicaset-controller",
    "groups": ["system:serviceaccounts", "system:serviceaccounts:kube-system", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["JTI=3b269adf-58bb-4737-8c9f-1b35da6f6bca"] }
  },
  "sourceIPs": ["10.0.0.1"],
  "userAgent": "kube-controller-manager/v1.35.1 (linux/arm64) kubernetes/8fea90b/system:serviceaccount:kube-system:replicaset-controller",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestReceivedTimestamp": "2026-04-11T14:58:26.451843Z",
  "stageTimestamp": "2026-04-11T14:58:26.455416Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "RBAC: allowed by ClusterRoleBinding \"system:controller:replicaset-controller\" of ClusterRole \"system:controller:replicaset-controller\" to ServiceAccount \"replicaset-controller/kube-system\""
  }
}
```

For an orphan pod created directly by a user, several fields change:

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "7ee822bc-3c2e-4f6d-a0cd-c394663cdd43",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods?fieldManager=kubectl-client-side-apply&fieldValidation=Strict",
  "verb": "create",
  "user": {
    "username": "jane",
    "groups": ["system:masters", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["X509SHA256=492cca92bcc2c74153290f6e3343e5d84a3498ab011963797f6545e681ac70d0"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "kubectl/v1.35.3 (darwin/arm64) kubernetes/6c1cd99",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "name": "order-service-7d4f9c8b6-m4l1c",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestReceivedTimestamp": "2026-04-11T14:59:02.015967Z",
  "stageTimestamp": "2026-04-11T14:59:02.026510Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": ""
  }
}
```

The pod name `order-service-7d4f9c8b6-m4l1c` follows the controller-managed pattern exactly, but the username is `jane`, the userAgent is `kubectl`, and the requestURI includes `fieldManager=kubectl-client-side-apply`.

## Direct API Calls

A pod created via a raw HTTP call to the API server, using `curl` or any other HTTP client, produces the same kind of audit event. The difference is in the `userAgent` and `requestURI` fields.

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "auditID": "279c4874-5bcf-45e8-9ff2-9e41720b5896",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/pods",
  "verb": "create",
  "user": {
    "username": "system:serviceaccount:production:deployer",
    "uid": "545a0313-dde5-4431-9381-4b3930902272",
    "groups": ["system:serviceaccounts", "system:serviceaccounts:production", "system:authenticated"],
    "extra": { "authentication.kubernetes.io/credential-id": ["JTI=830e888f-0677-4bf3-8e89-e6c0ee4390df"] }
  },
  "sourceIPs": ["203.0.113.45"],
  "userAgent": "curl/8.7.1",
  "objectRef": {
    "resource": "pods",
    "namespace": "production",
    "name": "order-service-7d4f9c8b6-x9r2k",
    "apiVersion": "v1"
  },
  "responseStatus": { "metadata": {}, "code": 201 },
  "requestReceivedTimestamp": "2026-04-11T15:20:12.849509Z",
  "stageTimestamp": "2026-04-11T15:20:12.854510Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "RBAC: allowed by ClusterRoleBinding \"default-pod-create\" of ClusterRole \"edit\" to ServiceAccount \"deployer/production\""
  }
}
```

The `requestURI` contains no `fieldManager` query parameter since that is added by kubectl, not by raw API calls. The `userAgent` shows `curl/8.7.1` rather than a kubectl version string.

The `userAgent` field is set by the client and can be spoofed. An attacker using `curl` can pass `-H "User-Agent: kubectl/v1.35.3 (linux/amd64) kubernetes/6c1cd99"` to mimic a kubectl call. The most reliable field for detection remains `user.username`, regardless of what the client claims in its headers.

## Querying the Audit Log

The API server writes audit events as newline-delimited JSON. Where those events land depends on how the cluster is set up.

**Self-managed clusters (kubeadm, bare metal)**

Audit logs are written to a file on the control plane node, configured via the `--audit-log-path` flag on the API server. The path is typically `/var/log/kubernetes/audit.log`. Query the log file directly on the control plane node:

```bash
grep '"verb":"create"' /var/log/kubernetes/audit.log \
  | grep '"resource":"pods"'
```

**Managed clusters (EKS, GKE, AKS)**

Cloud providers route control plane audit logs to their own logging services. You do not have direct access to the API server pod.

On **EKS**, audit events land in CloudWatch Logs under the log group `/aws/eks/<cluster>/cluster` in streams named `kube-apiserver-audit-*`. Control plane logging must be enabled first, either through the cluster's **Logging** settings in the console or by running `aws eks update-cluster-config` with the `audit` type set to enabled. Without this, no audit events are forwarded.

On **GKE**, audit events go to Cloud Logging under `projects/<project>/logs/cloudaudit.googleapis.com%2Factivity`. Admin Activity logs, which cover write operations including pod creation, are enabled by default and cannot be turned off. Data Access logs covering read operations require separate enablement and may incur additional cost. Query with `gcloud logging read` or through the Cloud Logging console.

On **AKS**, audit events require a diagnostic setting that forwards logs to a Log Analytics workspace. With resource-specific mode enabled, events appear in the `AKSAudit` table. In Azure Diagnostics mode they land in the `AzureDiagnostics` table and can be filtered with `Category == "kube-audit"`. Query both using KQL in the Log Analytics workspace.

Filter for `verb=create` on the `pods` resource and exclude known controller accounts. Anything remaining was created outside normal controller workflows:

```output
2026-04-11T14:59:02Z  user=jane  pod=order-service-7d4f9c8b6-m4l1c  ns=production
```

Known controller service accounts to exclude:

| Service Account | Responsible for |
| --- | --- |
| `system:serviceaccount:kube-system:replicaset-controller` | Deployment and ReplicaSet pods |
| `system:serviceaccount:kube-system:statefulset-controller` | StatefulSet pods |
| `system:serviceaccount:kube-system:daemon-set-controller` | DaemonSet pods |
| `system:serviceaccount:kube-system:job-controller` | Job pods |
| `system:serviceaccount:kube-system:cronjob-controller` | CronJob pods |
| `system:kube-scheduler` | Scheduling binding events |

## Confirming with ownerReferences

Once the audit log surfaces a candidate, check whether the pod has a parent controller:

```bash
kubectl get pods -n <namespace> \
  -o custom-columns='NAME:.metadata.name,OWNER:.metadata.ownerReferences[0].kind,OWNER_NAME:.metadata.ownerReferences[0].name'
```

```output
NAME                              OWNER        OWNER_NAME
order-service-7d4f9c8b6-xkp2t   ReplicaSet   order-service-7d4f9c8b6
order-service-7d4f9c8b6-rn7qw   ReplicaSet   order-service-7d4f9c8b6
order-service-7d4f9c8b6-m4l1c   <none>       <none>
```

A pod flagged by the audit log that also shows `<none>` for both owner columns confirms the masquerading pattern. The name copies the convention of the legitimate pods above it, but no controller owns it.

## Limitations

This detection depends on audit logging being enabled with at least `Metadata` level coverage for the `pods` resource. A minimal audit policy that satisfies this requirement:

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: ""
        resources: ["pods"]
```

Check the API server for the `--audit-policy-file` flag to confirm a policy is active. Clusters without it configured produce no audit events and cannot surface this signal.

Direct pod creation by a legitimate operator also appears in this output. Treat each result as a lead that requires the ownerReferences confirmation step rather than an automated alert.
