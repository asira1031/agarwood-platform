import {
  getMissionInventoryItems,
  getMissionKeyFromText,
  isActiveMissionStatus,
  missionNeedsInventory,
} from "./tree-mission-engine";

export type SubscriptionMissionDecision = {
  shouldGenerate: boolean;
  missionKey: string;
  reason: string;
  requiresInventory: boolean;
  inventoryItems: string[];
};

type SubscriptionLike = {
  tree_id?: string | null;
  group_id?: string | null;
  status?: string | null;
  auto_renew_enabled?: boolean | null;
  care_program_name?: string | null;
  next_renewal_date?: string | null;
};

type TreeLike = {
  tree_id?: string | null;
  id?: string | null;
  group_id?: string | null;
  care_status?: string | null;
};

type OperationLike = {
  tree_id?: string | null;
  group_id?: string | null;
  status?: string | null;
  service_name?: string | null;
  operation_type?: string | null;
  request_type?: string | null;
  care_program_name?: string | null;
};

function getSubscriptionStatus(
  value: TreeLike | SubscriptionLike,
): string {
  if ("status" in value && typeof value.status === "string") {
    return value.status;
  }

  if ("care_status" in value && typeof value.care_status === "string") {
    return value.care_status;
  }

  return "";
}

export function isCareSubscriptionActive(
  treeOrSubscription: TreeLike | SubscriptionLike | null | undefined,
) {
  if (!treeOrSubscription) return false;

  const status = getSubscriptionStatus(treeOrSubscription)
    .trim()
    .toUpperCase();

  return ["ACTIVE", "SUBSCRIBED", "PROTECTED"].includes(status);
}

function operationText(operation: OperationLike) {
  return [
    operation.service_name,
    operation.operation_type,
    operation.request_type,
    operation.care_program_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasActiveDuplicate(
  tree: TreeLike,
  existingOperations: OperationLike[],
  missionKey: string,
) {
  const treeId = tree.tree_id || tree.id || null;
  const groupId = tree.group_id || null;

  return existingOperations.some((operation) => {
    if (!isActiveMissionStatus(operation.status)) return false;

    const sameMission =
      getMissionKeyFromText(operationText(operation)) === missionKey;

    if (!sameMission) return false;

    if (treeId && operation.tree_id) {
      return String(operation.tree_id) === String(treeId);
    }

    if (!operation.tree_id && groupId && operation.group_id) {
      return String(operation.group_id) === String(groupId);
    }

    return false;
  });
}

export function getNextSubscriptionMission(
  tree: TreeLike,
  existingOperations: OperationLike[],
): SubscriptionMissionDecision {
  const missionKey = "CARE_PROGRAM";

  if (hasActiveDuplicate(tree, existingOperations, missionKey)) {
    return {
      shouldGenerate: false,
      missionKey,
      reason: "Active mission already exists for this subscription target.",
      requiresInventory: missionNeedsInventory(missionKey),
      inventoryItems: getMissionInventoryItems(missionKey),
    };
  }

  return {
    shouldGenerate: true,
    missionKey,
    reason: "Active subscription is ready for the next care mission.",
    requiresInventory: missionNeedsInventory(missionKey),
    inventoryItems: getMissionInventoryItems(missionKey),
  };
}

export function shouldAutoGenerateMission(
  tree: TreeLike,
  subscriptions: SubscriptionLike[],
  existingOperations: OperationLike[],
): SubscriptionMissionDecision {
  const treeId = tree.tree_id || tree.id || null;
  const groupId = tree.group_id || null;

  const hasActiveSubscription =
    isCareSubscriptionActive(tree) ||
    subscriptions.some((subscription) => {
      if (!isCareSubscriptionActive(subscription)) return false;

      const sameTree =
        treeId &&
        subscription.tree_id &&
        String(subscription.tree_id) === String(treeId);

      const sameGroup =
        groupId &&
        subscription.group_id &&
        String(subscription.group_id) === String(groupId);

      return Boolean(sameTree || sameGroup);
    });

  if (!hasActiveSubscription) {
    return {
      shouldGenerate: false,
      missionKey: "CARE_PROGRAM",
      reason: "No active care subscription found.",
      requiresInventory: false,
      inventoryItems: [],
    };
  }

  return getNextSubscriptionMission(tree, existingOperations);
}