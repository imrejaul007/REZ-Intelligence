# REZ Agent OS - Terraform Infrastructure
# AWS EKS + RDS + ElastiCache deployment

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket = "rez-terraform-state"
    key    = "rez-infra/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = aws_eks_cluster.rez-cluster.endpoint
  token                  = data.aws_eks_cluster_auth.rez-cluster.token
  cluster_ca_certificate = base64decode(aws_eks_cluster.rez-cluster.certificate_authority.0.data)
}

provider "helm" {
  kubernetes {
    host                   = aws_eks_cluster.rez-cluster.endpoint
    token                  = data.aws_eks_cluster_auth.rez-cluster.token
    cluster_ca_certificate = base64decode(aws_eks_cluster.rez-cluster.certificate_authority.0.data)
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "rez-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_instance_type" {
  description = "EC2 instance type for worker nodes"
  type        = string
  default     = "t3.large"
}

variable "desired_capacity" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 3
}

variable "min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 10
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_storage" {
  description = "RDS storage in GB"
  type        = number
  default     = 100
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 2
}

# =============================================================================
# VPC & Networking
# =============================================================================

resource "aws_vpc" "rez_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "rez-vpc-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "rez_igw" {
  vpc_id = aws_vpc.rez_vpc.id

  tags = {
    Name = "rez-igw-${var.environment}"
  }
}

resource "aws_subnet" "private" {
  count = 3

  vpc_id            = aws_vpc.rez_vpc.id
  cidr_block        = cidrsubnet(aws_vpc.rez_vpc.cidr_block, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "rez-private-subnet-${count.index + 1}"
    Type = "private"
  }
}

resource "aws_subnet" "public" {
  count = 3

  vpc_id            = aws_vpc.rez_vpc.id
  cidr_block        = cidrsubnet(aws_vpc.rez_vpc.cidr_block, 4, count.index + 3)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "rez-public-subnet-${count.index + 1}"
    Type = "public"
  }
}

resource "aws_nat_gateway" "rez_nat" {
  count = 2

  connectivity_type = "public"
  subnet_id        = aws_subnet.public[count.index].id

  tags = {
    Name = "rez-nat-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.rez_igw]
}

resource "aws_eip" "nat_eip" {
  count  = 2
  domain = "vpc"

  tags = {
    Name = "rez-nat-eip-${count.index + 1}"
  }
}

resource "aws_route_table" "private" {
  count  = 2

  vpc_id = aws_vpc.rez_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.rez_nat[count.index].id
  }

  tags = {
    Name = "rez-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.rez_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.rez_igw.id
  }

  tags = {
    Name = "rez-public-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = 3

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index % 2].id
}

resource "aws_route_table_association" "public" {
  count = 3

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# EKS Cluster
# =============================================================================

resource "aws_eks_cluster" "rez_cluster" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs    = ["0.0.0.0/0"]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_service_policy,
  ]
}

# EKS Node Group
resource "aws_eks_node_group" "rez_nodes" {
  cluster_name    = aws_eks_cluster.rez_cluster.name
  node_group_name = "rez-workers"
  node_role_arn   = aws_iam_role.workers.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = [var.node_instance_type]

  scaling_config {
    desired_size = var.desired_capacity
    max_size     = var.max_size
    min_size     = var.min_size
  }

  depends_on = [
    aws_iam_role_policy_attachment.workers_node,
    aws_iam_role_policy_attachment.workers_cni,
    aws_iam_role_policy_attachment.workers_registry,
  ]
}

# =============================================================================
# RDS PostgreSQL
# =============================================================================

resource "aws_db_subnet_group" "rez_db_subnet" {
  name       = "rez-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "rez-db-subnet"
  }
}

resource "aws_security_group" "db_sg" {
  name        = "rez-db-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.rez_vpc.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rez-db-sg"
  }
}

resource "aws_db_instance" "rez_db" {
  identifier     = "rez-db-${var.environment}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_storage
  max_allocated_storage = 500
  storage_encrypted     = true
  storage_type          = "gp3"

  db_name  = "rezdb"
  username = "rezadmin"
  password = aws_secretsmanager_secret_version.db_password.secret_string

  db_subnet_group_name   = aws_db_subnet_group.rez_db_subnet.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]

  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "mon:03:00-mon:04:00"
  multi_az                = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  skip_final_snapshot = false
  final_snapshot_identifier = "rez-db-final-snapshot"

  tags = {
    Name        = "rez-db-${var.environment}"
    Environment = var.environment
  }
}

# =============================================================================
# ElastiCache Redis
# =============================================================================

resource "aws_elasticache_subnet_group" "rez_redis_subnet" {
  name       = "rez-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "redis_sg" {
  name        = "rez-redis-sg"
  description = "Security group for ElastiCache"
  vpc_id      = aws_vpc.rez_vpc.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  tags = {
    Name = "rez-redis-sg"
  }
}

resource "aws_elasticache_replication_group" "rez_redis" {
  replication_group_id       = "rez-redis-${var.environment}"
  replication_group_description = "REZ Redis cluster"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  number_cache_clusters = var.redis_num_nodes

  parameter_group_name         = "default.redis7"
  port                         = 6379
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token_enabled          = true

  cache_subnet_group_name  = aws_elasticache_subnet_group.rez_redis_subnet.name
  security_group_ids       = [aws_security_group.redis_sg.id]

  maintenance_window = "mon:03:00-mon:04:00"
  snapshot_window    = "02:00-03:00"
  snapshot_retention_limit = 7

  tags = {
    Name        = "rez-redis-${var.environment}"
    Environment = var.environment
  }
}

# =============================================================================
# IAM Roles
# =============================================================================

resource "aws_iam_role" "eks_cluster" {
  name = "rez-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_service_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role" "workers" {
  name = "rez-eks-workers-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "workers_node" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.workers.name
}

resource "aws_iam_role_policy_attachment" "workers_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.workers.name
}

resource "aws_iam_role_policy_attachment" "workers_registry" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.workers.name
}

# =============================================================================
# Node Security Group
# =============================================================================

resource "aws_security_group" "eks_nodes" {
  name        = "rez-eks-nodes-sg"
  description = "Security group for EKS nodes"
  vpc_id      = aws_vpc.rez_vpc.id

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "-1"
    cidr_blocks = [aws_vpc.rez_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rez-eks-nodes-sg"
  }
}

# =============================================================================
# Secrets Manager
# =============================================================================

resource "aws_secretsmanager_secret" "db_password" {
  name        = "rez-db-password"
  description = "REZ database password"

  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# =============================================================================
# S3 Bucket for Terraform State
# =============================================================================

resource "aws_s3_bucket" "terraform_state" {
  bucket = "rez-terraform-state-${data.aws_caller_identity.current.account_id}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "eks_cluster_endpoint" {
  value       = aws_eks_cluster.rez_cluster.endpoint
  description = "EKS cluster endpoint"
}

output "eks_cluster_name" {
  value       = aws_eks_cluster.rez_cluster.name
  description = "EKS cluster name"
}

output "eks_cluster_arn" {
  value       = aws_eks_cluster.rez_cluster.arn
  description = "EKS cluster ARN"
}

output "db_endpoint" {
  value       = aws_db_instance.rez_db.endpoint
  description = "RDS database endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.rez_redis.primary_endpoint_address
  description = "ElastiCache Redis endpoint"
}

output "vpc_id" {
  value       = aws_vpc.rez_vpc.id
  description = "VPC ID"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Private subnet IDs"
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_eks_cluster_auth" "rez_cluster" {
  name = aws_eks_cluster.rez_cluster.name
}