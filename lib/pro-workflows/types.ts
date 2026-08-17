export type ProWorkflowStage = {
  id: string;
  workflowId: string;
  name: string;
  description: string | null;
  sort: number;
};

export type ProWorkflowCard = {
  id: string;
  workflowId: string;
  stageId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  sort: number;
  isExample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProWorkflow = {
  id: string;
  spaceId: string;
  name: string;
  description: string | null;
  starterKey: string | null;
  sort: number;
  stages: ProWorkflowStage[];
  cards: ProWorkflowCard[];
};

export type ProWorkflowBundle = {
  initialized: boolean;
  workflows: ProWorkflow[];
};

export type ProWorkflowSeed = {
  key: string;
  name: string;
  description: string;
  stages: Array<{ name: string; description: string }>;
  example: { title: string; notes: string };
};
