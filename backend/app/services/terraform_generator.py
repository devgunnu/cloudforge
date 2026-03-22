"""
Terraform HCL generation service.

Takes CloudForge architecture data and generates production-ready Terraform code
using Claude (Anthropic) as the LLM backbone.
"""

import json
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings

logger = logging.getLogger(__name__)

# System prompt for Terraform generation
TERRAFORM_SYSTEM_PROMPT = """You are an expert AWS infrastructure engineer and Terraform specialist.
Given a CloudForge architecture specification, generate production-ready Terraform HCL code.

Rules:
1. Use Terraform >= 1.6 with AWS provider ~> 5.0
2. Use an S3 backend for state storage
3. Parameterize with variables (region, project_name, environment)
4. Add proper tags to all resources: Project, Environment, ManagedBy=CloudForge
5. Follow AWS security best practices:
   - Least privilege IAM policies
   - Encryption at rest and in transit
   - VPC isolation where applicable
   - Security groups with minimal ingress
6. Include outputs for resource ARNs and endpoints
7. Use consistent naming: ${var.project_name}-${var.environment}-<resource>
8. Add lifecycle rules where appropriate (prevent_destroy for databases)

Output Format:
Return a JSON object with this structure:
{
  "files": [
    {
      "name": "main.tf",
      "path": "infra/main.tf",
      "content": "... HCL content ..."
    },
    ...
  ],
  "plan_summary": "Brief description of what will be created",
  "estimated_resources": 5,
  "warnings": ["any warnings about the config"]
}

Generate separate files for: main.tf (provider/backend), variables.tf, outputs.tf,
and one file per major resource group (e.g., lambda.tf, rds.tf, etc.)."""


class TerraformGenerator:
    """Generates Terraform HCL from CloudForge architecture specifications."""

    def __init__(self):
        self.llm = self._init_llm()

    def _init_llm(self) -> ChatAnthropic:
        """Initialize the Claude LLM for Terraform generation."""
        return ChatAnthropic(
            model=getattr(settings, "anthropic_model", "claude-sonnet-4-20250514"),
            temperature=0.1,
            max_tokens=8192,
            anthropic_api_key=getattr(settings, "anthropic_api_key", None),
        )

    async def generate(
        self,
        architecture_data: dict[str, Any],
        project_name: str = "cloudforge-project",
        region: str = "us-east-1",
        environment: str = "prod",
    ) -> dict[str, Any]:
        """
        Generate Terraform files from architecture specification.

        Args:
            architecture_data: Dict with 'nodes' and 'edges' from the forge pipeline
            project_name: Name of the project for resource naming
            region: AWS region to deploy to
            environment: Deployment environment (dev/staging/prod)

        Returns:
            Dict with 'files', 'plan_summary', 'estimated_resources', 'warnings'
        """
        nodes = architecture_data.get("nodes", [])
        edges = architecture_data.get("edges", [])

        if not nodes:
            return {
                "files": [],
                "plan_summary": "No resources to generate",
                "estimated_resources": 0,
                "warnings": ["No architecture nodes provided"],
            }

        prompt = self._build_prompt(nodes, edges, project_name, region, environment)

        logger.info(
            "Generating Terraform for %d nodes, %d edges", len(nodes), len(edges)
        )

        try:
            response = await self.llm.ainvoke(
                [
                    SystemMessage(content=TERRAFORM_SYSTEM_PROMPT),
                    HumanMessage(content=prompt),
                ]
            )

            result = self._parse_response(response.content)
            logger.info(
                "Generated %d Terraform files", len(result.get("files", []))
            )
            return result

        except Exception as e:
            logger.error("Terraform generation failed: %s", str(e))
            # Fallback: generate basic Terraform from templates
            return self._generate_fallback(nodes, edges, project_name, region, environment)

    def _build_prompt(
        self,
        nodes: list[dict],
        edges: list[dict],
        project_name: str,
        region: str,
        environment: str,
    ) -> str:
        """Build the user prompt with architecture details."""
        arch_spec = {
            "project_name": project_name,
            "region": region,
            "environment": environment,
            "resources": [],
            "connections": [],
        }

        for node in nodes:
            arch_spec["resources"].append({
                "id": node.get("id"),
                "name": node.get("label"),
                "description": node.get("sublabel", ""),
                "type": node.get("type"),
                "terraform_resource": node.get("terraformResource"),
                "estimated_cost": node.get("estimatedCost"),
                "config": node.get("config", {}),
                "requirements": node.get("validates", []),
            })

        for edge in edges:
            arch_spec["connections"].append({
                "from": edge.get("from"),
                "to": edge.get("to"),
            })

        return f"""Generate Terraform HCL for the following CloudForge architecture:

```json
{json.dumps(arch_spec, indent=2)}
```

Requirements:
- {len(nodes)} AWS resources to provision
- All resources in {region}
- Project name: {project_name}
- Environment: {environment}
- Include proper IAM roles and security groups
- Wire service connections based on the edges (e.g., Lambda → RDS means Lambda needs DB endpoint env var)
"""

    def _parse_response(self, content: str) -> dict[str, Any]:
        """Parse the LLM response into structured Terraform output."""
        if isinstance(content, list):
            # Handle Anthropic's content block format
            text = ""
            for block in content:
                if hasattr(block, "text"):
                    text += block.text
                elif isinstance(block, dict) and "text" in block:
                    text += block["text"]
                elif isinstance(block, str):
                    text += block
            content = text

        # Try to extract JSON from the response
        try:
            # Look for JSON block in markdown
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
            else:
                json_str = content.strip()

            result = json.loads(json_str)

            # Validate structure
            if "files" not in result:
                result = {"files": [], "plan_summary": "Parse error", "estimated_resources": 0, "warnings": ["Could not parse LLM response"]}

            return result

        except (json.JSONDecodeError, IndexError) as e:
            logger.warning("Failed to parse LLM JSON response: %s", str(e))
            return {
                "files": [],
                "plan_summary": "Failed to parse response",
                "estimated_resources": 0,
                "warnings": [f"JSON parse error: {str(e)}"],
            }

    def _generate_fallback(
        self,
        nodes: list[dict],
        edges: list[dict],
        project_name: str,
        region: str,
        environment: str,
    ) -> dict[str, Any]:
        """Generate basic Terraform from templates when LLM fails."""
        files = []

        # main.tf
        main_tf = f'''terraform {{
  required_version = ">= 1.6"
  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
  backend "s3" {{
    bucket = "{project_name}-tf-state"
    key    = "{project_name}/terraform.tfstate"
    region = "{region}"
  }}
}}

provider "aws" {{
  region = var.aws_region

  default_tags {{
    tags = {{
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "CloudForge"
    }}
  }}
}}
'''
        files.append({"name": "main.tf", "path": "infra/main.tf", "content": main_tf})

        # variables.tf
        variables_tf = f'''variable "project_name" {{
  type    = string
  default = "{project_name}"
}}

variable "environment" {{
  type    = string
  default = "{environment}"
}}

variable "aws_region" {{
  type    = string
  default = "{region}"
}}
'''
        files.append({"name": "variables.tf", "path": "infra/variables.tf", "content": variables_tf})

        # Generate resource files from nodes
        resource_map = {
            "aws_lambda_function": self._gen_lambda_tf,
            "aws_db_instance": self._gen_rds_tf,
            "aws_elasticache_cluster": self._gen_elasticache_tf,
            "aws_apigatewayv2_api": self._gen_apigateway_tf,
            "aws_secretsmanager_secret": self._gen_secrets_tf,
        }

        outputs = []
        for node in nodes:
            tf_resource = node.get("terraformResource", "")
            generator = resource_map.get(tf_resource)
            if generator:
                file_info, output_lines = generator(node, project_name, environment)
                files.append(file_info)
                outputs.extend(output_lines)

        # outputs.tf
        if outputs:
            outputs_content = "\n\n".join(outputs)
            files.append({"name": "outputs.tf", "path": "infra/outputs.tf", "content": outputs_content})

        return {
            "files": files,
            "plan_summary": f"Fallback generation: {len(nodes)} resources across {len(files)} files",
            "estimated_resources": len(nodes),
            "warnings": ["Generated from templates (LLM unavailable). Review before applying."],
        }

    @staticmethod
    def _gen_lambda_tf(node: dict, project_name: str, environment: str) -> tuple[dict, list[str]]:
        config = node.get("config", {})
        resource_name = node.get("id", "function")
        content = f'''resource "aws_lambda_function" "{resource_name}" {{
  function_name = "${{var.project_name}}-${{var.environment}}-{node.get("label", "function").lower().replace(" ", "-")}"
  runtime       = "{config.get("runtime", "nodejs20.x")}"
  handler       = "index.handler"
  memory_size   = {config.get("memory", "512").replace(" MB", "")}
  timeout       = {config.get("timeout", "10").replace("s", "")}
  architectures = ["{config.get("architecture", "arm64")}"]

  role = aws_iam_role.{resource_name}_role.arn

  environment {{
    variables = {{
      NODE_ENV = var.environment
    }}
  }}

  tags = {{
    Name = "${{var.project_name}}-${{var.environment}}-{resource_name}"
  }}
}}

resource "aws_iam_role" "{resource_name}_role" {{
  name = "${{var.project_name}}-${{var.environment}}-{resource_name}-role"

  assume_role_policy = jsonencode({{
    Version = "2012-10-17"
    Statement = [{{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {{
        Service = "lambda.amazonaws.com"
      }}
    }}]
  }})
}}

resource "aws_iam_role_policy_attachment" "{resource_name}_basic" {{
  role       = aws_iam_role.{resource_name}_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}}
'''
        outputs = [
            f'output "{resource_name}_arn" {{\n  value = aws_lambda_function.{resource_name}.arn\n}}',
            f'output "{resource_name}_function_name" {{\n  value = aws_lambda_function.{resource_name}.function_name\n}}',
        ]
        return {"name": f"{resource_name}.tf", "path": f"infra/{resource_name}.tf", "content": content}, outputs

    @staticmethod
    def _gen_rds_tf(node: dict, project_name: str, environment: str) -> tuple[dict, list[str]]:
        config = node.get("config", {})
        resource_name = node.get("id", "database")
        content = f'''resource "aws_db_instance" "{resource_name}" {{
  identifier        = "${{var.project_name}}-${{var.environment}}-db"
  engine            = "{config.get("engine", "postgres")}"
  engine_version    = "{config.get("version", "15")}"
  instance_class    = "{config.get("instance", "db.t3.micro")}"
  allocated_storage = {config.get("storage", "20").replace(" GB", "")}

  db_name  = replace("${{var.project_name}}_${{var.environment}}", "-", "_")
  username = var.db_username
  password = var.db_password

  skip_final_snapshot     = var.environment != "prod"
  backup_retention_period = {config.get("backup_retention", "7").replace(" days", "")}
  deletion_protection     = var.environment == "prod"
  storage_encrypted       = true

  tags = {{
    Name = "${{var.project_name}}-${{var.environment}}-db"
  }}

  lifecycle {{
    prevent_destroy = false
  }}
}}

variable "db_username" {{
  type      = string
  default   = "cloudforge_admin"
  sensitive = true
}}

variable "db_password" {{
  type      = string
  sensitive = true
}}
'''
        outputs = [
            f'output "{resource_name}_endpoint" {{\n  value = aws_db_instance.{resource_name}.endpoint\n}}',
            f'output "{resource_name}_address" {{\n  value = aws_db_instance.{resource_name}.address\n}}',
        ]
        return {"name": f"{resource_name}.tf", "path": f"infra/{resource_name}.tf", "content": content}, outputs

    @staticmethod
    def _gen_elasticache_tf(node: dict, project_name: str, environment: str) -> tuple[dict, list[str]]:
        config = node.get("config", {})
        resource_name = node.get("id", "cache")
        content = f'''resource "aws_elasticache_cluster" "{resource_name}" {{
  cluster_id      = "${{var.project_name}}-${{var.environment}}-cache"
  engine          = "{config.get("engine", "redis")}"
  engine_version  = "{config.get("version", "7.0")}"
  node_type       = "{config.get("instance", "cache.t3.micro")}"
  num_cache_nodes = 1
  port            = 6379

  parameter_group_name = "default.redis7"

  tags = {{
    Name = "${{var.project_name}}-${{var.environment}}-cache"
  }}
}}
'''
        outputs = [
            f'output "{resource_name}_endpoint" {{\n  value = aws_elasticache_cluster.{resource_name}.cache_nodes[0].address\n}}',
        ]
        return {"name": f"{resource_name}.tf", "path": f"infra/{resource_name}.tf", "content": content}, outputs

    @staticmethod
    def _gen_apigateway_tf(node: dict, project_name: str, environment: str) -> tuple[dict, list[str]]:
        config = node.get("config", {})
        resource_name = node.get("id", "api")
        content = f'''resource "aws_apigatewayv2_api" "{resource_name}" {{
  name          = "${{var.project_name}}-${{var.environment}}-api"
  protocol_type = "{config.get("protocol", "HTTP")}"

  cors_configuration {{
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }}

  tags = {{
    Name = "${{var.project_name}}-${{var.environment}}-api"
  }}
}}

resource "aws_apigatewayv2_stage" "{resource_name}_default" {{
  api_id      = aws_apigatewayv2_api.{resource_name}.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {{
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }}
}}
'''
        outputs = [
            f'output "{resource_name}_endpoint" {{\n  value = aws_apigatewayv2_api.{resource_name}.api_endpoint\n}}',
            f'output "{resource_name}_id" {{\n  value = aws_apigatewayv2_api.{resource_name}.id\n}}',
        ]
        return {"name": f"{resource_name}.tf", "path": f"infra/{resource_name}.tf", "content": content}, outputs

    @staticmethod
    def _gen_secrets_tf(node: dict, project_name: str, environment: str) -> tuple[dict, list[str]]:
        config = node.get("config", {})
        resource_name = node.get("id", "secret")
        content = f'''resource "aws_secretsmanager_secret" "{resource_name}" {{
  name                    = "${{var.project_name}}-${{var.environment}}-{node.get("label", "secret").lower().replace(" ", "-")}"
  recovery_window_in_days = 7

  tags = {{
    Name = "${{var.project_name}}-${{var.environment}}-{resource_name}"
  }}
}}

resource "aws_secretsmanager_secret_rotation" "{resource_name}_rotation" {{
  secret_id           = aws_secretsmanager_secret.{resource_name}.id
  rotation_rules {{
    automatically_after_days = {config.get("rotation", "90").replace(" days", "")}
  }}
}}
'''
        outputs = [
            f'output "{resource_name}_arn" {{\n  value = aws_secretsmanager_secret.{resource_name}.arn\n}}',
        ]
        return {"name": f"{resource_name}.tf", "path": f"infra/{resource_name}.tf", "content": content}, outputs
