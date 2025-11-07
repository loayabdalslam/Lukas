export enum Agent {
  SearchAgent = 'SearchAgent',
  MapsAgent = 'MapsAgent',
  VisionAgent = 'VisionAgent',
  VideoAgent = 'VideoAgent',
  EmailAgent = 'EmailAgent',
  SheetsAgent = 'SheetsAgent',
  DriveAgent = 'DriveAgent',
  ImageGenerationAgent = 'ImageGenerationAgent',
  Orchestrator = 'Orchestrator',
  User = 'User',
}

export interface PlanStep {
  step: number;
  agent: Agent;
  task: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
  agent: Agent;
}

export interface StoredFile {
    id: string;
    name: string;
    data: Record<string, any>[]; // Array of objects for table data
    createdAt: string;
}

export interface StepResult {
  step: number;
  agent: Agent;
  task:string;
  result: string;
  sources?: GroundingSource[];
  status: 'pending' | 'running' | 'completed' | 'error';
  imageBase64?: string;
}

export interface Geolocation {
    latitude: number;
    longitude: number;
}

export interface Clarification {
    question: string;
    options: { key: string; value: string; }[];
}


export interface Exchange {
    id: string;
    prompt: string;
    imageFile: File | null;
    videoFile: File | null;
    plan: PlanStep[] | null;
    results: StepResult[];
    status: 'planning' | 'clarification_needed' | 'executing' | 'completed' | 'error';
    generatedFile?: StoredFile | null;
    clarification?: Clarification | null;
    errorMessage?: string;
}

export interface Conversation {
    id: string;
    title: string;
    exchanges: Exchange[];
}
