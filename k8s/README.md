# 🚀 StoneFlow Enterprise: Docker & Kubernetes (K8s) Scaling Guide

This directory contains the production-grade Kubernetes manifest files and deployment architecture for containerizing and horizontally scaling the **StoneFlow Application** with **Clerk Authentication**.

---

## 🏗️ Architecture Overview

```text
               +----------------------------------+
               |        NGINX Ingress / TLS       |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |     Kubernetes Service (3000)    |
               +----------------------------------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
        v                       v                       v
 +--------------+        +--------------+        +--------------+
 | Pod 1 (3000) |        | Pod 2 (3000) |        | Pod 3 (3000) | ... [HPA Autoscaling up to 10]
 +--------------+        +--------------+        +--------------+
        \                       |                       /
         +----------------------+----------------------+
                                |
                                v
                +--------------------------------+
                | PersistentVolumeClaim (10Gi)   |
                +--------------------------------+
```

---

## 🔑 1. Clerk Authentication Setup

The application uses **Clerk** (`@clerk/clerk-react`) for secure User Authentication & SSO.

### Setting up Environment Variables in Kubernetes
1. Copy `k8s/secret.yaml.example` to `k8s/secret.yaml`:
   ```bash
   cp k8s/secret.yaml.example k8s/secret.yaml
   ```
2. Insert your Clerk API keys into `k8s/secret.yaml`:
   ```yaml
   stringData:
     VITE_CLERK_PUBLISHABLE_KEY: "pk_test_YOUR_CLERK_KEY"
     CLERK_SECRET_KEY: "sk_test_YOUR_CLERK_SECRET"
     GEMINI_API_KEY: "YOUR_GEMINI_KEY"
   ```

---

## 🐳 2. Containerization with Docker

### Build Docker Image
```bash
docker build -t stoneflow-app:latest .
```

### Run Locally with Docker
```bash
docker run -p 3000:3000 \
  -e VITE_CLERK_PUBLISHABLE_KEY="pk_test_..." \
  -e NODE_ENV="production" \
  --name stoneflow-container stoneflow-app:latest
```

### Verify Container Health
```bash
curl http://localhost:3000/health
```

---

## ☸️ 3. Deploying to Kubernetes (K8s)

### Apply All Manifests
To deploy the entire stack to your Kubernetes cluster (Minikube, EKS, GKE, AKS, or microk8s):

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 📈 4. Horizontal Pod Autoscaling (HPA)

The Horizontal Pod Autoscaler monitors real-time CPU and Memory utilization:
* **Min Replicas:** 3
* **Max Replicas:** 10
* **CPU Target Utilization:** 60%
* **Memory Target Utilization:** 75%

### Inspect HPA Status
```bash
kubectl get hpa -n stoneflow
```

---

## 🩺 5. Monitoring & Maintenance Commands

### Check Running Pods
```bash
kubectl get pods -n stoneflow -o wide
```

### View Live Container Logs
```bash
kubectl logs -f -l app=stoneflow -n stoneflow --tail=100
```

### Rolling Update Deployment
```bash
kubectl rollout restart deployment/stoneflow-app -n stoneflow
```

---

## 🛡️ Security Features
* **Non-Root Execution:** Runs under security context `UID 1000 (node)`.
* **Zero-Downtime Updates:** `RollingUpdate` strategy guarantees `maxUnavailable: 0`.
* **Liveness & Readiness Probes:** Kubernetes automatically replaces unresponsive pods via `/health` endpoint.
