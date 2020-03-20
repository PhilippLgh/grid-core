export interface WorkflowInfo {
  id: string;
  workflowId: string;
  name: string;
  displayName: string;
  version: string;
  specifier?: string;
  isInstalled: boolean;
}

type Timestamp = number

export interface JobInfo extends WorkflowInfo {
  started_at?: Timestamp
  finished_at?: Timestamp
  state: string;
}

export interface WorkflowInfoQuery {
  state?: string;
  isInstalled?: boolean;
}