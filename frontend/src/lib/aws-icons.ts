export type AwsIconKey =
  | 'lambda'
  | 's3'
  | 'apigateway'
  | 'sqs'
  | 'eventbridge'
  | 'bedrock'
  | 'neptune'
  | 'amplify'
  | 'dynamodb'
  | 'rds'
  | 'cloudfront'
  | 'sns'
  | 'internet'
  | 'cognito'
  | 'ecs'
  | 'stepfunctions'
  | 'route53'
  | 'elb'
  | 'ec2'
  | 'eks'
  | 'kinesis'
  | 'cloudwatch'
  | 'xray'
  | 'secretsmanager'
  | 'iam'
  | 'users'
  | 'generic';

export interface AwsIcon {
  viewBox: string;
  glyphTransform: string;
  path: string;
}

export const AWS_ICONS: Record<AwsIconKey, AwsIcon> = {
  lambda: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Greek λ symbol — two diagonal lines with crossbar
    path: 'M 20 64 L 38 20 M 38 20 L 60 64 M 27 46 L 46 46',
  },
  s3: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Storage bucket — trapezoid lid + rectangular body
    path: 'M 22 26 L 24 20 L 56 20 L 58 26 Z M 22 26 L 24 62 L 56 62 L 58 26 M 30 44 L 50 44',
  },
  apigateway: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Two vertical bars + right-pointing arrow
    path: 'M 16 18 L 16 62 M 26 18 L 26 62 M 36 40 L 64 40 M 54 30 L 64 40 L 54 50',
  },
  sqs: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Three horizontal message bands (queue)
    path: 'M 12 24 L 68 24 M 12 40 L 68 40 M 12 56 L 68 56 M 58 18 L 68 24 L 58 30',
  },
  eventbridge: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Event bus — vertical bar with horizontal branches
    path: 'M 40 12 L 40 68 M 40 28 L 20 28 L 14 22 M 40 28 L 60 28 L 66 22 M 40 52 L 20 52 L 14 58 M 40 52 L 60 52 L 66 58',
  },
  bedrock: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Sparkle/star (AI foundation)
    path: 'M 40 12 L 44 36 L 68 40 L 44 44 L 40 68 L 36 44 L 12 40 L 36 36 Z',
  },
  neptune: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Graph nodes connected — 3 circles + edges
    path: 'M 40 18 A 7 7 0 1 0 40.01 18 M 18 58 A 7 7 0 1 0 18.01 58 M 62 58 A 7 7 0 1 0 62.01 58 M 40 25 L 22 52 M 40 25 L 58 52 M 25 58 L 55 58',
  },
  amplify: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Zigzag waveform (amplification)
    path: 'M 10 50 L 22 20 L 34 60 L 46 20 L 58 60 L 70 30',
  },
  dynamodb: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Lightning bolt (speed/NoSQL)
    path: 'M 48 12 L 26 46 L 42 46 L 32 68 L 54 34 L 38 34 Z',
  },
  rds: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Database cylinder with two rings
    path: 'M 18 26 Q 18 16 40 16 Q 62 16 62 26 L 62 54 Q 62 64 40 64 Q 18 64 18 54 Z M 18 26 Q 18 36 40 36 Q 62 36 62 26 M 18 44 Q 18 54 40 54 Q 62 54 62 44',
  },
  cloudfront: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Globe with equator + one meridian
    path: 'M 40 12 A 28 28 0 1 0 40.01 12 M 12 40 L 68 40 M 40 12 Q 24 40 40 68 Q 56 40 40 12',
  },
  sns: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Megaphone / notification horn
    path: 'M 16 30 L 16 50 L 28 50 L 48 62 L 48 18 L 28 30 Z M 28 30 L 28 50 M 54 26 Q 62 32 62 40 Q 62 48 54 54',
  },
  internet: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Globe (browser/client)
    path: 'M 40 12 A 28 28 0 1 0 40.01 12 M 12 40 L 68 40 M 40 12 Q 24 40 40 68 Q 56 40 40 12 M 14 26 Q 40 34 66 26 M 14 54 Q 40 46 66 54',
  },
  cognito: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Person silhouette (identity)
    path: 'M 40 12 A 14 14 0 1 0 40.01 12 M 16 68 Q 16 50 40 50 Q 64 50 64 68',
  },
  ecs: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // 2x2 container grid
    path: 'M 12 12 L 36 12 L 36 36 L 12 36 Z M 44 12 L 68 12 L 68 36 L 44 36 Z M 12 44 L 36 44 L 36 68 L 12 68 Z M 44 44 L 68 44 L 68 68 L 44 68 Z',
  },
  stepfunctions: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // State machine — rectangles connected by lines
    path: 'M 28 14 L 52 14 L 52 28 L 28 28 Z M 40 28 L 40 38 M 40 38 L 22 38 L 22 52 L 40 52 M 40 38 L 58 38 L 58 52 M 22 52 L 22 66 M 58 52 L 58 66',
  },
  route53: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Concentric circles target (DNS)
    path: 'M 40 14 A 26 26 0 1 0 40.01 14 M 40 22 A 18 18 0 1 0 40.01 22 M 40 32 A 8 8 0 1 0 40.01 32 M 40 38 L 40 42',
  },
  elb: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Load balancer — single point fanning out
    path: 'M 40 18 L 40 34 M 40 34 L 16 52 M 40 34 L 40 52 M 40 34 L 64 52 M 10 52 L 26 52 L 26 66 L 10 66 Z M 34 52 L 50 52 L 50 66 L 34 66 Z M 54 52 L 70 52 L 70 66 L 54 66 Z',
  },
  ec2: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Server with two racks + legs
    path: 'M 12 22 L 68 22 L 68 36 L 12 36 Z M 12 42 L 68 42 L 68 56 L 12 56 Z M 20 27 A 2 2 0 1 0 20.01 27 M 20 47 A 2 2 0 1 0 20.01 47 M 28 29 L 54 29 M 28 49 L 54 49 M 28 62 L 28 72 M 52 62 L 52 72',
  },
  eks: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Kubernetes wheel — hub + 8 spokes
    path: 'M 40 16 L 40 26 M 40 54 L 40 64 M 16 40 L 26 40 M 54 40 L 64 40 M 22 22 L 29 29 M 51 51 L 58 58 M 58 22 L 51 29 M 29 51 L 22 58 M 40 30 A 10 10 0 1 0 40.01 30',
  },
  kinesis: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Three streaming wave lines
    path: 'M 10 28 Q 28 16 46 28 Q 64 40 70 28 M 10 40 Q 28 28 46 40 Q 64 52 70 40 M 10 52 Q 28 40 46 52 Q 64 64 70 52',
  },
  cloudwatch: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Gauge/dial with needle
    path: 'M 18 50 A 24 24 0 0 1 62 50 M 22 38 A 20 20 0 0 1 58 38 M 40 50 L 30 30 M 40 50 A 4 4 0 1 0 40.01 50',
  },
  xray: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // X-ray scan — X shape with dashes
    path: 'M 18 18 L 62 62 M 62 18 L 18 62 M 10 40 L 22 40 M 58 40 L 70 40 M 40 10 L 40 22 M 40 58 L 40 70',
  },
  secretsmanager: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Lock with keyhole
    path: 'M 26 40 L 26 64 L 54 64 L 54 40 Z M 32 40 L 32 28 Q 32 16 40 16 Q 48 16 48 28 L 48 40 M 40 48 A 4 4 0 1 0 40.01 48 L 40 58',
  },
  iam: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Shield
    path: 'M 40 10 L 64 20 L 64 44 Q 64 60 40 70 Q 16 60 16 44 L 16 20 Z M 40 28 A 10 10 0 1 0 40.01 28',
  },
  users: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Person silhouette
    path: 'M 40 12 A 13 13 0 1 0 40.01 12 M 14 68 Q 14 48 40 48 Q 66 48 66 68',
  },
  generic: {
    viewBox: '0 0 80 80',
    glyphTransform: 'translate(0,0)',
    // Gear icon
    path: 'M 40 18 L 44 18 L 45 24 Q 49 26 52 29 L 58 27 L 62 31 L 60 37 Q 62 41 62 44 L 68 46 L 68 50 L 62 52 Q 62 55 60 59 L 62 65 L 58 69 L 52 67 Q 49 70 45 72 L 44 78 L 36 78 L 35 72 Q 31 70 28 67 L 22 69 L 18 65 L 20 59 Q 18 55 18 52 L 12 50 L 12 46 L 18 44 Q 18 41 20 37 L 18 31 L 22 27 L 28 29 Q 31 26 35 24 Z M 40 32 A 8 8 0 1 0 40.01 32',
  },
};
