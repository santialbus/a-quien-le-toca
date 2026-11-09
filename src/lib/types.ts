export type Member = { uid: string; name: string; joinedAt?: unknown };
export type Task = { id: string; title: string; createdAt?: unknown };
export type Penalty = {
  id: string; targetUid: string; targetName: string; type: "money" | "challenge";
  amount?: number; description: string; createdBy: string; createdAt?: unknown;
};
export type Draw = { id: string; winnerUid: string; winnerName: string; taskTitle: string; createdBy: string; createdAt?: unknown };
export type Group = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  defaultTasksAdded?: boolean;
};
export type RouletteState = {
  status: "spinning" | "finished";
  spinId: string;
  startedAt?: unknown;
  durationMs: number;
  winnerUid: string;
  winnerName: string;
  taskTitle: string;
  createdBy: string;
  drawId: string;
};