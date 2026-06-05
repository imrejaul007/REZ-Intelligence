# REZ Agent OS - Terraform Infrastructure

Infrastructure as Code for deploying REZ Agent OS on AWS EKS with RDS PostgreSQL and ElastiCache Redis.

## Prerequisites

1. **AWS CLI** configured with credentials:
   ```bash
   aws configure
   ```

2. **Terraform** installed:
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **kubectl** installed:
   ```bash
   brew install kubectl
   ```

## Quick Start

### 1. Initialize Terraform

```bash
cd deploy/terraform

# Initialize
terraform init

# Format
terraform fmt

# Validate
terraform validate
```

### 2. Configure Variables

```bash
# Copy example vars
cp terraform.tfvars.example terraform.tfvars

# Edit with your settings
vim terraform.tfvars
```

### 3. Plan & Apply

```bash
# Preview changes
terraform plan -out=plan.tfplan

# Apply infrastructure
terraform apply plan.tfplan
```

### 4. Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name rez-cluster

# Verify
kubectl get nodes
```

### 5. Deploy REZ with Helm

```bash
# Add Helm repo (if using external chart)
helm repo add rez https://charts.rez.io
helm repo update

# Or deploy from local chart
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  --create-namespace

# Check deployment
kubectl get pods -n rez-system
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     VPC (10.0.0.0/16)                   │   │
│  │                                                          │   │
│  │  ┌────────────────────┐    ┌────────────────────┐        │   │
│  │  │  Public Subnets    │    │  Private Subnets    │        │   │
│  │  │  (10.0.0.0/20)     │    │  (10.0.4.0/20)      │        │   │
│  │  │  ┌─────────────┐   │    │  ┌─────────────────┐│       │   │
│  │  │  │   NAT GW    │   │    │  │   EKS Cluster    ││       │   │
│  │  │  └─────────────┘   │    │  │  ┌───────────┐  ││       │   │
│  │  │                    │    │  │  │ REZ Pods  │  ││       │   │
│  │  │  ┌─────────────┐   │    │  │  └───────────┘  ││       │   │
│  │  │  │   Bastion    │   │    │  └─────────────────┘│       │   │
│  │  │  └─────────────┘   │    │  ┌─────────────────┐│       │   │
│  │  │                    │    │  │     RDS         ││       │   │
│  │  │                    │    │  │  (PostgreSQL)   ││       │   │
│  │  │                    │    │  └─────────────────┘│       │   │
│  │  │                    │    │  ┌─────────────────┐│       │   │
│  │  │                    │    │  │    ElastiCache  ││       │   │
│  │  │                    │    │  │     (Redis)     ││       │   │
│  │  │                    │    │  └─────────────────┘│       │   │
│  │  └────────────────────┘    └────────────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Infrastructure Components

### VPC
- CIDR: 10.0.0.0/16
- 3 Availability Zones
- Public subnets for NAT and Bastion
- Private subnets for EKS and managed services

### EKS Cluster
- Kubernetes 1.28
- Managed node group (t3.large by default)
- Auto-scaling: 2-10 nodes
- Private endpoint access enabled

### RDS PostgreSQL
- PostgreSQL 15.4
- db.r6g.large instance
- 100GB GP3 storage
- Multi-AZ deployment
- Automated backups (7 days)

### ElastiCache Redis
- Redis 7.0
- cache.r6g.large nodes
- 2-node cluster with replication
- Encryption at rest and in transit
- Automatic failover

## Configuration Options

### Node Sizing

```hcl
# Development
node_instance_type = "t3.medium"
desired_capacity   = 2
min_size           = 1
max_size           = 4

# Production
node_instance_type = "t3.xlarge"
desired_capacity   = 5
min_size           = 3
max_size           = 20

# High Performance
node_instance_type = "m5.2xlarge"
desired_capacity   = 10
min_size           = 5
max_size           = 50
```

### Database Sizing

```hcl
# Small
db_instance_class = "db.r6g.large"
db_storage        = 50

# Medium
db_instance_class = "db.r6g.xlarge"
db_storage        = 200

# Large
db_instance_class = "db.r6g.2xlarge"
db_storage        = 500
```

## Outputs

After deployment, Terraform provides:

```bash
# Get outputs
terraform output

# EKS endpoint
terraform output eks_cluster_endpoint

# Database endpoint
terraform output db_endpoint

# Redis endpoint
terraform output redis_endpoint
```

## Upgrading Infrastructure

```bash
# Update infrastructure
terraform apply

# Update only node group
terraform apply -target=aws_eks_node_group.rez_nodes
```

## Destroying Infrastructure

```bash
# Destroy all resources
terraform destroy

# Destroy with confirmation
terraform destroy -auto-approve
```

## Remote State

State is stored in S3 with:

```hcl
backend "s3" {
  bucket = "rez-terraform-state"
  key    = "rez-infra/terraform.tfstate"
  region = "us-east-1"
}
```

**IMPORTANT**: Enable versioning and encryption on the S3 bucket for state recovery.

## Security

- VPC with private subnets for all workloads
- Security groups restricting access
- RDS with encrypted storage
- ElastiCache with TLS
- Secrets stored in AWS Secrets Manager
- IAM roles with least privilege

## Monitoring

CloudWatch is configured for:

- EKS cluster logs
- RDS metrics and logs
- ElastiCache metrics
- Node-level metrics

## Cost Optimization

Tips for reducing costs:

1. Use Spot instances for non-production:
   ```hcl
   capacity_type = "SPOT"
   ```

2. Enable autoscaling to scale down during off-hours

3. Use Reserved Instances for baseline capacity

4. Set up billing alerts

## Troubleshooting

### Node Group Not Creating

```bash
# Check IAM roles
aws iam list-roles | grep rez

# Check VPC endpoints
aws ec2 describe-vpc-endpoints --filters "vpc-id=$(terraform output -raw vpc_id)"
```

### Database Connection Failed

```bash
# Test from bastion
psql -h $(terraform output -raw db_endpoint) -U rezadmin -d rezdb

# Check security groups
aws ec2 describe-security-groups --filters "group-names=rez-db-sg"
```

### EKS Auth Issues

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name rez-cluster

# Test connection
kubectl get nodes
```

## Next Steps

After infrastructure deployment:

1. [Deploy REZ with Helm](./helm/rez/README.md)
2. [Configure monitoring](./monitoring/README.md)
3. [Set up CI/CD](./.github/workflows/README.md)
4. [Review security settings](./docs/security/SECURITY.md)