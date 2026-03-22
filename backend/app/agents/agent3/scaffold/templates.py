from __future__ import annotations

import json
import textwrap


def render_frontend_package_json(project_name: str) -> str:
    data = {
        "name": project_name,
        "version": "0.1.0",
        "private": True,
        "scripts": {
            "dev": "vite",
            "build": "tsc && vite build",
            "preview": "vite preview",
        },
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
        },
        "devDependencies": {
            "vite": "^5.0.0",
            "@vitejs/plugin-react": "^4.0.0",
            "typescript": "^5.0.0",
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
        },
    }
    return json.dumps(data, indent=2)


def render_vite_config() -> str:
    return textwrap.dedent("""\
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react()],
          server: {
            proxy: {
              '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
              },
            },
          },
        });
    """)


def render_frontend_tsconfig() -> str:
    data = {
        "compilerOptions": {
            "target": "ESNext",
            "useDefineForClassFields": True,
            "lib": ["DOM", "DOM.Iterable", "ESNext"],
            "allowJs": False,
            "skipLibCheck": True,
            "esModuleInterop": False,
            "allowSyntheticDefaultImports": True,
            "strict": True,
            "forceConsistentCasingInFileNames": True,
            "module": "ESNext",
            "moduleResolution": "bundler",
            "resolveJsonModule": True,
            "isolatedModules": True,
            "noEmit": True,
            "jsx": "react-jsx",
        },
        "include": ["src"],
        "references": [{"path": "./tsconfig.node.json"}],
    }
    return json.dumps(data, indent=2)


def render_frontend_index_html(project_name: str) -> str:
    return textwrap.dedent(f"""\
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <link rel="icon" type="image/svg+xml" href="/vite.svg" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{project_name}</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/src/main.tsx"></script>
          </body>
        </html>
    """)


def render_frontend_main_tsx() -> str:
    return textwrap.dedent("""\
        import React from 'react';
        import ReactDOM from 'react-dom/client';
        import App from './App';

        ReactDOM.createRoot(document.getElementById('root')!).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
    """)


def render_amplify_yml() -> str:
    return textwrap.dedent("""\
        version: 1
        frontend:
          phases:
            preBuild:
              commands:
                - cd frontend && npm ci
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: frontend/dist
            files:
              - '**/*'
          cache:
            paths:
              - frontend/node_modules/**/*
    """)


def render_buildspec_yaml() -> str:
    return textwrap.dedent("""\
        version: 0.2
        phases:
          install:
            runtime-versions:
              nodejs: 20
            commands:
              - cd infrastructure && npm ci
          build:
            commands:
              - npx cdk synth
              - npx cdk deploy --all --require-approval never
          post_build:
            commands:
              - echo "CDK deployment complete at $(date)"
        artifacts:
          files:
            - infrastructure/cdk.out/**/*
    """)


def render_lambda_requirements_stub(service_id: str) -> str:
    return textwrap.dedent(f"""\
        # Requirements for {service_id}
        boto3>=1.34.0
    """)


def render_layers_requirements() -> str:
    return textwrap.dedent("""\
        aws-lambda-powertools>=2.30.0
        pydantic>=2.5.0
        boto3>=1.34.0
    """)


def render_kinesis_dockerfile(service_id: str) -> str:
    return textwrap.dedent(f"""\
        FROM amazoncorretto:21-alpine

        WORKDIR /app

        COPY pom.xml .
        RUN mvn dependency:go-offline -B

        COPY src ./src
        RUN mvn package -DskipTests

        ENTRYPOINT ["java", "-jar", "target/app.jar"]
    """)


def render_gitignore(layer: str) -> str:
    if layer == "root":
        return textwrap.dedent("""\
            node_modules/
            .env
            __pycache__/
            *.pyc
            cdk.out/
            dist/
            .DS_Store
            *.egg-info/
            .venv/
            .pytest_cache/
        """)
    if layer == "cdk":
        return textwrap.dedent("""\
            cdk.out/
            node_modules/
            dist/
            *.js
            *.d.ts
            !jest.config.js
        """)
    if layer == "frontend":
        return textwrap.dedent("""\
            node_modules/
            dist/
            .env
            .env.local
            .DS_Store
        """)
    return ""


def render_root_env_example(service_ids: list[str], has_rds: bool) -> str:
    lines: list[str] = [
        "# Environment variables — copy to .env and fill in values",
        "",
        "AWS_REGION=us-east-1",
        "AWS_ACCOUNT_ID=",
        "PROJECT_NAME=",
        "",
    ]
    if has_rds:
        lines += [
            "# RDS connection",
            "DB_HOST=",
            "DB_PORT=5432",
            "DB_NAME=",
            "DB_USER=",
            "DB_PASSWORD=",
            "",
        ]
    if service_ids:
        lines.append("# Lambda function names")
        for sid in service_ids:
            lines.append(f"{sid.upper()}_FUNCTION_NAME=")
        lines.append("")
    return "\n".join(lines)
