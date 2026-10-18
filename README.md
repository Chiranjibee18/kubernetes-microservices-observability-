# 🚀 Production Kubernetes Microservices Platform: Scaling, Routing & Observability

[![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.28%2B-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Helm](https://img.shields.io/badge/Helm-v3.12-0F1689?logo=helm&logoColor=white)](https://helm.sh/)
[![Prometheus](https://img.shields.io/badge/Monitoring-Prometheus-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Dashboards-Grafana-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

> **Architected & Engineered by:** [Chiranjibee Panigrahi](https://github.com/Chiranjibee18)  
> **Role Alignment:** AWS DevOps Engineer | Kubernetes Administrator | Cloud Platform Engineer  
> **Status:** Production-Ready, Tested with k6 Load Ingestion & Auto-Scaling Verified  

---

## 📌 Architecture & Data Flow

```
                      [ External Client / Web Traffic ]
                                     │
                                     ▼
                ┌───────────────────────────────────────────┐
                │        NGINX Ingress Controller           │
                │        TLS Termination & Routing          │
                └─────────────┬─────────────────┬───────────┘
          /api/orders         │                 │ /api/notify
                              ▼                 ▼
             ┌───────────────────────┐   ┌───────────────────────┐
             │     Order Service     │   │  Notification Service │
             │  ClusterIP: Port 80   │   │  ClusterIP: Port 3001 │
             └───────────┬───────────┘   └───────────┬───────────┘
                         │                           │
         Async Dispatch  │                           │
         ────────────────┘                           │
                         │                           │
                         ▼                           ▼
            ┌─────────────────────────────────────────────┐
            │   Horizontal Pod Autoscaler (HPA v2)        │
            │   Target: 60% CPU / 70% Memory (Min 2, Max 8│
            └──────────────────────┬──────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │       Prometheus Metrics Scraper          │
             │       /metrics (p99 latency, RPS)         │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │       Grafana Observability Board         │
             │   Real-time throughput & saturation stats │
             └───────────────────────────────────────────┘
```

---

## 🔑 Core Engineering Highlights

### 1. Hardened Multi-Stage Containerization
- **Minimal Surface Area:** Dockerfiles use multi-stage builds (`node:18-alpine` builder → `runner`), dropping build tooling to reduce final image size by **~45%**.
- **Least-Privilege Execution:** Containers execute strictly under the unprivileged `node` user (`UID 1000`). Root privileges and privilege escalation are blocked (`allowPrivilegeEscalation: false`).
- **Signal Handling:** Packaged with `dumb-init` to properly trap `SIGTERM` and `SIGINT` signals, ensuring graceful socket draining upon pod eviction.

### 2. High-Availability & Self-Healing Deployments
- **Zero-Downtime Rollouts:** Configured with `RollingUpdate` strategy (`maxSurge: 1`, `maxUnavailable: 0`), guaranteeing uninterrupted user traffic during deployments.
- **Liveness Probe (`/healthz`):** Automatically detects deadlocks and restarts unresponsive containers.
- **Readiness Probe (`/ready`):** Isolates unready containers from the Kubernetes Service endpoints, preventing 502/503 errors during cold starts.
- **Graceful Draining:** Upon receiving `SIGTERM`, the application sets readiness to `false`, finishes inflight HTTP requests within a 10s grace window, and terminates cleanly.

### 3. Dynamic Autoscaling (HPA v2)
- Targets **60% average CPU utilization** and **70% memory saturation**.
- **Ramp-up policy:** Scales aggressively during traffic surges (up to +100% or +2 pods every 15s).
- **Cooldown stabilization window (300s):** Eliminates "thrashing" / pod flapping during transient traffic dips.

### 4. Enterprise Observability Stack
- **Prometheus Instrumentation:** Custom business metrics (`orders_created_total`, `notifications_sent_total`) and RED metrics (`http_request_duration_seconds` histogram for p50/p95/p99 latency analysis).
- **Grafana Visualization:** Pre-packaged dashboard JSON tracking RPS, error rates, HPA replica states, and CPU/memory saturation.
- **Alertmanager Rules:** Critical alerts for `HighHttpErrorRate` (>5% 5xx errors), `PodCrashLooping` (>2 restarts/5m), and `HighMemorySaturation` (>85%).

---

## 📂 Repository Directory Layout

```text
kubernetes-microservices-observability/
├── .github/workflows/
│   └── ci-cd.yml                # Automated Linting, Trivy scan, and K8s dry-run validation
├── src/
│   ├── order-service/           # Express.js REST API with prom-client & probes
│   │   ├── Dockerfile           # Multi-stage hardened build
│   │   ├── package.json
│   │   ├── server.js
│   │   └── test.js
│   └── notification-service/    # Event notification microservice
│       ├── Dockerfile
│       ├── package.json
│       └── server.js
├── k8s/
│   ├── namespace.yaml           # Production namespace
│   ├── ingress.yaml             # Ingress with path-based routing & TLS
│   ├── order-service/           # Deployment, Service, HPA, ConfigMap, Secret
│   └── notification-service/    # Deployment, Service, ConfigMap
├── helm/
│   └── microservices/           # Production Helm v3 packaging
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── monitoring/
│   ├── alerts.yaml              # Prometheus alerting rules
│   ├── service-monitor.yaml     # Prometheus Operator ServiceMonitor
│   ├── grafana-dashboard.json   # Ready-to-import Grafana dashboard
│   └── prometheus-local.yml     # Standalone Prometheus scrape config
├── load-test/
│   └── k6-load-test.js          # Traffic injection scenario triggering HPA autoscaling
└── docker-compose.yml           # Full local multi-service stack with Prometheus
```

---

## 🚀 Quickstart & Deployment Guide

### Option 1: Run Locally via Docker Compose
```bash
# Clone the repository
git clone https://github.com/Chiranjibee18/kubernetes-microservices-observability.git
cd kubernetes-microservices-observability

# Build and start all microservices + Prometheus
docker compose up --build -d

# Verify services
curl http://localhost:3000/healthz
curl http://localhost:3000/metrics
# Prometheus UI is available at: http://localhost:9090
```

### Option 2: Deploy to Kubernetes Cluster (Minikube / kind / EKS)
```bash
# 1. Create Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Deploy Order & Notification Services
kubectl apply -f k8s/order-service/
kubectl apply -f k8s/notification-service/

# 3. Deploy Ingress Controller & Routing
kubectl apply -f k8s/ingress.yaml

# 4. Deploy Prometheus Alerting Rules
kubectl apply -f monitoring/alerts.yaml

# 5. Check Deployment Status
kubectl get pods,svc,hpa -n microservices-prod
```

---

## 🧪 Load Testing & Validating HPA Autoscaling

We simulate a traffic spike using **k6** to force CPU utilization past 60%:

```bash
# In a separate terminal, watch HPA in real-time
kubectl get hpa order-service-hpa -n microservices-prod --watch

# Execute the k6 load test (spikes up to 150 concurrent virtual users)
k6 run --env TARGET_URL=http://<INGRESS_IP> load-test/k6-load-test.js
```

### Expected Scaling Progression:
1. **Initial State:** `2/2` replicas (CPU ~5%).
2. **Load Spike:** CPU climbs to `140% / 60%`.
3. **Autoscaling Triggered:** HPA scales `2 -> 4 -> 8` replicas within 45 seconds.
4. **Load Drops:** HPA holds 8 pods for 300 seconds (stabilization window) before gradually scaling back to 2 replicas, preventing thrashing.

---

## 🎓 Technical Interview Defense (FAQ)

### Q1: What is the difference between a Liveness Probe and a Readiness Probe?
> **Answer:** 
> * **Liveness Probe:** Detects if the process is deadlocked or broken. If it fails, Kubernetes kills the pod and restarts it according to the `restartPolicy`.
> * **Readiness Probe:** Detects if the container is ready to accept client traffic (e.g. database connections initialized, caches warmed). If it fails, Kubernetes does **not** restart the pod; it simply removes the pod's IP from the Service endpoints list so no traffic is routed to it.

### Q2: Why is a cooldown/stabilization window necessary in HPA?
> **Answer:** Network traffic is inherently spiky. If HPA scaled down immediately when CPU dropped for a few seconds, pods would be killed, only to be relaunched moments later when another traffic burst hits (a failure mode known as **thrashing** or **flapping**). The 300s stabilization window ensures capacity remains available until demand has truly subsided.

### Q3: How do you handle graceful shutdowns in Kubernetes?
> **Answer:** When Kubernetes terminates a pod, it sends a `SIGTERM` signal and removes the pod from endpoints. If the application doesn't catch `SIGTERM`, active TCP sockets are immediately dropped. In our `server.js`, we catch `SIGTERM`, fail the `/ready` endpoint, stop accepting new connections, finish inflight requests, and exit cleanly with code 0.

---

## 📜 License
This project is open-source and licensed under the MIT License.
