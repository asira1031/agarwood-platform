export type MissionKey =
  | "GPS_VERIFICATION"
  | "PHOTO_UPDATE"
  | "WATERING"
  | "FERTILIZER"
  | "HEALTH_CHECK"
  | "QR_TAGGING"
  | "CARE_PROGRAM"
  | "PEST_CONTROL"
  | "PRUNING"
  | "TREE_OPERATION";

export type MissionEvidenceMode =
  | "GPS_ONLY"
  | "PHOTO_CURRENT_ONLY"
  | "PHOTO_BEFORE_AFTER"
  | "HEALTH_ONLY";

export type MissionEvidenceTable =
  | "tree_photo_updates"
  | "tree_gps_logs"
  | "tree_health_reports";

export type MissionCategory =
  | "Verification"
  | "Maintenance"
  | "Inspection"
  | "Protection Plan"
  | "General";

export type TreeMissionRule = {
  key: MissionKey;
  label: string;
  category: MissionCategory;
  evidenceMode: MissionEvidenceMode;
  evidenceLabel: string;
  evidenceTable: MissionEvidenceTable;
  requiresInventory: boolean;
  inventoryItems: string[];
  customerDescription: string;
  gardenerInstruction: string;
  adminReviewRule: string;
};

export const TREE_MISSION_RULES: Record<MissionKey, TreeMissionRule> = {
  GPS_VERIFICATION: {
    key: "GPS_VERIFICATION",
    label: "GPS Verification",
    category: "Verification",
    evidenceMode: "GPS_ONLY",
    evidenceLabel: "GPS only",
    evidenceTable: "tree_gps_logs",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Verify the exact plantation location and tree identity from the field.",
    gardenerInstruction: "Submit GPS coordinates only. No photo or health report is required for this mission.",
    adminReviewRule: "Approve only when at least one GPS log is submitted.",
  },
  PHOTO_UPDATE: {
    key: "PHOTO_UPDATE",
    label: "Photo Update",
    category: "Verification",
    evidenceMode: "PHOTO_CURRENT_ONLY",
    evidenceLabel: "Current photo only",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Request a current field photo update for the selected tree or forest.",
    gardenerInstruction: "Submit one current proof photo only.",
    adminReviewRule: "Approve only when at least one current photo is submitted.",
  },
  WATERING: {
    key: "WATERING",
    label: "Watering",
    category: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Request watering support from the plantation operation team.",
    gardenerInstruction: "Submit before and after photos only.",
    adminReviewRule: "Approve only when photo evidence is submitted.",
  },
  FERTILIZER: {
    key: "FERTILIZER",
    label: "Fertilizer",
    category: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    evidenceTable: "tree_photo_updates",
    requiresInventory: true,
    inventoryItems: ["fertilizer"],
    customerDescription: "Request fertilizer application using available customer inventory.",
    gardenerInstruction: "Confirm fertilizer supply used, then submit before and after photos only.",
    adminReviewRule: "Approve only when photo evidence is submitted. Inventory requirement must be visible but not deducted here.",
  },
  HEALTH_CHECK: {
    key: "HEALTH_CHECK",
    label: "Health Check",
    category: "Inspection",
    evidenceMode: "HEALTH_ONLY",
    evidenceLabel: "Health status only",
    evidenceTable: "tree_health_reports",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Request a field health inspection and status report.",
    gardenerInstruction: "Submit health status only. No GPS or photo is required for this mission.",
    adminReviewRule: "Approve only when at least one health report is submitted.",
  },
  QR_TAGGING: {
    key: "QR_TAGGING",
    label: "QR Tag Installation",
    category: "Verification",
    evidenceMode: "PHOTO_CURRENT_ONLY",
    evidenceLabel: "QR proof photo",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Install or verify the physical QR tag attached to the assigned tree.",
    gardenerInstruction: "Submit one QR installation proof photo only.",
    adminReviewRule: "Approve only when QR proof photo is submitted.",
  },
  CARE_PROGRAM: {
    key: "CARE_PROGRAM",
    label: "Care Program",
    category: "Protection Plan",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Subscribed care missions are handled through Admin and Gardener workflow with real evidence.",
    gardenerInstruction: "Submit before and after photos for the actual field care mission.",
    adminReviewRule: "Approve only when required photo evidence is submitted. Care status activates only for care program missions.",
  },
  PEST_CONTROL: {
    key: "PEST_CONTROL",
    label: "Pest Control",
    category: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    evidenceTable: "tree_photo_updates",
    requiresInventory: true,
    inventoryItems: ["pesticide", "fungicide"],
    customerDescription: "Request pest or fungal protection treatment when the tree needs field intervention.",
    gardenerInstruction: "Confirm pesticide or fungicide supply used, then submit before and after photos only.",
    adminReviewRule: "Approve only when photo evidence is submitted. Inventory requirement must be visible but not deducted here.",
  },
  PRUNING: {
    key: "PRUNING",
    label: "Pruning",
    category: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "Request pruning or field cleanup support for the selected tree or forest.",
    gardenerInstruction: "Submit before and after photos only.",
    adminReviewRule: "Approve only when photo evidence is submitted.",
  },
  TREE_OPERATION: {
    key: "TREE_OPERATION",
    label: "Tree Operation",
    category: "General",
    evidenceMode: "PHOTO_CURRENT_ONLY",
    evidenceLabel: "Photo evidence required",
    evidenceTable: "tree_photo_updates",
    requiresInventory: false,
    inventoryItems: [],
    customerDescription: "General tree operation mission.",
    gardenerInstruction: "Submit the required proof for this tree operation.",
    adminReviewRule: "Approve when relevant evidence exists. Photo evidence is preferred for generic missions.",
  },
};

export const TREE_MISSION_RULE_LIST = Object.values(TREE_MISSION_RULES);
