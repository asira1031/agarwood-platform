import {
  TREE_MISSION_RULES,
  MissionEvidenceMode,
  MissionEvidenceTable,
  MissionKey,
  TreeMissionRule,
} from "./tree-mission-rules";

export type MissionEvidenceBundle = {
  photos?: unknown[];
  gps?: unknown[];
  health?: unknown[];
};

export type MissionOperationLike = {
  tree_id?: string | null;
  group_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
};

export type MissionTreeLike = {
  tree_id?: string | null;
  id?: string | null;
};

export const ACTIVE_MISSION_STATUSES = [
  "PENDING",
  "REQUESTED",
  "PAID",
  "PROCESSING",
  "NOT_ASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
];

export const TERMINAL_MISSION_STATUSES = [
  "COMPLETED",
  "APPROVED",
  "CANCELLED",
  "CANCELED",
  "REJECTED",
  "FAILED",
];

export function normalizeMissionText(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/__+/g, "_")
    .toUpperCase();
}

export function getMissionKeyFromText(value: unknown): MissionKey {
  const text = normalizeMissionText(value);

  if (text.includes("GPS")) return "GPS_VERIFICATION";
  if (text.includes("QR")) return "QR_TAGGING";
  if (text.includes("HEALTH") || text.includes("INSPECTION")) return "HEALTH_CHECK";
  if (text.includes("PEST") || text.includes("FUNGICIDE") || text.includes("INSECT")) return "PEST_CONTROL";
  if (text.includes("PRUN")) return "PRUNING";
  if (text.includes("FERT")) return "FERTILIZER";
  if (text.includes("WATER")) return "WATERING";
  if (text.includes("CARE_PROGRAM") || text.includes("CARE_PROGRAMS") || text.includes("PROTECTION") || text.includes("SUBSCRIPTION")) return "CARE_PROGRAM";
  if (text.includes("PHOTO") || text.includes("PICTURE") || text.includes("IMAGE")) return "PHOTO_UPDATE";

  return "TREE_OPERATION";
}

export function getMissionRule(value: unknown): TreeMissionRule {
  return TREE_MISSION_RULES[getMissionKeyFromText(value)];
}

export function getMissionLabel(value: unknown) {
  return getMissionRule(value).label;
}

export function getMissionEvidenceMode(value: unknown): MissionEvidenceMode {
  return getMissionRule(value).evidenceMode;
}

export function getMissionRequirement(value: unknown) {
  return getMissionRule(value).evidenceLabel;
}

export function getMissionEvidenceTable(value: unknown): MissionEvidenceTable {
  return getMissionRule(value).evidenceTable;
}

export function missionNeedsInventory(value: unknown) {
  return getMissionRule(value).requiresInventory;
}

export function getMissionInventoryItems(value: unknown) {
  return [...getMissionRule(value).inventoryItems];
}

export function isTerminalMissionStatus(status: unknown) {
  return TERMINAL_MISSION_STATUSES.includes(normalizeMissionText(status));
}

export function isActiveMissionStatus(status: unknown) {
  const normalized = normalizeMissionText(status || "PENDING");
  return normalized === "" || ACTIVE_MISSION_STATUSES.includes(normalized);
}

export function missionStatusLabel(status: unknown) {
  const normalized = normalizeMissionText(status || "PENDING");

  if (["PENDING", "REQUESTED", "PAID", "PROCESSING", "NOT_ASSIGNED", ""].includes(normalized)) return "Waiting for Admin";
  if (normalized === "ASSIGNED") return "Assigned to Gardener";
  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "SUBMITTED") return "Submitted for Review";
  if (normalized === "COMPLETED" || normalized === "APPROVED") return "Completed";
  if (normalized === "REWORK_REQUESTED") return "Rework Requested";
  if (normalized === "CANCELLED" || normalized === "CANCELED" || normalized === "REJECTED") return "Closed";

  return String(status || "Waiting for Admin");
}

export function hasRequiredEvidenceForMission(
  missionKey: unknown,
  evidence: MissionEvidenceBundle,
) {
  const key = getMissionKeyFromText(missionKey);
  const photos = evidence.photos || [];
  const gps = evidence.gps || [];
  const health = evidence.health || [];

  if (key === "GPS_VERIFICATION") return gps.length > 0;
  if (key === "HEALTH_CHECK") return health.length > 0;

  if (
    key === "PHOTO_UPDATE" ||
    key === "QR_TAGGING" ||
    key === "WATERING" ||
    key === "FERTILIZER" ||
    key === "CARE_PROGRAM" ||
    key === "PEST_CONTROL" ||
    key === "PRUNING"
  ) {
    return photos.length > 0;
  }

  return photos.length > 0 || gps.length > 0 || health.length > 0;
}

function newestTime(row: MissionOperationLike) {
  return new Date(row.updated_at || row.created_at || 0).getTime();
}

export function sortMissionsByNewest<T extends MissionOperationLike>(rows: T[]) {
  return [...rows].sort((a, b) => newestTime(b) - newestTime(a));
}

export function treeOnlyOperations<T extends MissionOperationLike>(
  tree: MissionTreeLike | null | undefined,
  operationRequests: T[],
) {
  const treeId = tree?.tree_id || tree?.id;
  if (!treeId) return [];

  return sortMissionsByNewest(
    operationRequests.filter((request) => String(request.tree_id || "") === String(treeId)),
  );
}

export function forestLevelOperations<T extends MissionOperationLike>(
  forestId: string | null | undefined,
  operationRequests: T[],
) {
  if (!forestId) return [];

  return sortMissionsByNewest(
    operationRequests.filter(
      (request) => !request.tree_id && String(request.group_id || "") === String(forestId),
    ),
  );
}
