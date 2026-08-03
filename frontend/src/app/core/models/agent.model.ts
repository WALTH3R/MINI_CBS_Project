export interface Agent {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
}

export interface AgentCreatePayload {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
}
