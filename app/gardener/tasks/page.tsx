"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getMissionEvidenceMode,
  getMissionInventoryItems,
  getMissionKeyFromText,
  getMissionLabel,
  getMissionRequirement,
  getMissionRule,
  missionNeedsInventory,
} from "@/lib/tree-mission-engine";

type Row = Record<string, any>;

type TaskTab = "ASSIGNED" | "IN_PROGRESS";

type EvidenceMode =
  | "GPS_ONLY"
  | "PHOTO_CURRENT_ONLY"
  | "PHOTO_BEFORE_AFTER"
  | "HEALTH_ONLY";

type VerifiedTree = {
  treeId: string;
  treeCode: string;
  treeName: string;
  groupId: string | null;
};

type WorkItem = {
  key: string;
  assignment: Row;
  task: Row | null;
  request: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  evidenceStatus: string;
  serviceKey: string;
  evidenceMode: EvidenceMode;
};

type InsertedEvidenceIds = {
  photoIds: string[];
  gpsIds: string[];
  healthIds: string[];
};

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "CANCELED", "REJECTED", "FAILED"];

function normalize(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function statusOf(value: any) {
  const status = normalize(value || "ASSIGNED");

  if (status === "STARTED") return "IN_PROGRESS";
  if (status === "REWORK" || status === "NEEDS_REWORK") return "REWORK_REQUESTED";

  return status;
}

function mergeStatus(...values: any[]) {
  const statuses = values.map(statusOf).filter(Boolean);

  if (statuses.some((status) => status === "COMPLETED")) return "COMPLETED";
  if (statuses.some((status) => status === "REJECTED")) return "REJECTED";
  if (statuses.some((status) => status === "CANCELLED" || status === "CANCELED")) return "CANCELLED";
  if (statuses.some((status) => status === "SUBMITTED")) return "SUBMITTED";
  if (statuses.some((status) => status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.some((status) => status === "REWORK_REQUESTED")) return "REWORK_REQUESTED";
  if (statuses.some((status) => status === "ASSIGNED")) return "ASSIGNED";

  return statuses[0] || "ASSIGNED";
}

function unique(values: any[]) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();

  rows.forEach((row) => {
    if (row?.id) map.set(String(row.id), row);
  });

  return map;
}

function formatDate(value: any) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTreeName(tree: Row | null | undefined) {
  return (
    tree?.custom_name ||
    tree?.display_name ||
    tree?.tree_name ||
    tree?.name ||
    tree?.tree_code ||
    "Assigned Tree"
  );
}

function getForestName(group: Row | null | undefined, tree?: Row | null) {
  return (
    group?.forest_name ||
    group?.group_name ||
    tree?.tree_group_name ||
    tree?.forest_name ||
    "Assigned Forest"
  );
}

function getOwnerName(customer: Row | null | undefined) {
  return customer?.full_name || customer?.display_name || customer?.email || "Customer";
}

function rawServiceText(assignment: Row | null, task: Row | null, request: Row | null) {
  return [
    task?.source_type,
    task?.task_type,
    assignment?.source_type,
    assignment?.assignment_type,
    request?.service_name,
    request?.operation_type,
    request?.request_type,
    request?.care_program_name,
  ]
    .map((value) => String(value || ""))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function getServiceKey(assignment: Row | null, task: Row | null, request: Row | null) {
  return getMissionKeyFromText(rawServiceText(assignment, task, request));
}

function getEvidenceMode(serviceKey: string): EvidenceMode {
  return getMissionEvidenceMode(serviceKey);
}

function getServiceLabel(serviceKey: string) {
  return getMissionLabel(serviceKey);
}

function getServiceIcon(evidenceMode: EvidenceMode, serviceKey: string) {
  if (serviceKey.includes("QR")) return "▦";
  if (serviceKey.includes("CARE_PROGRAM")) return "🛡️";
  if (evidenceMode === "GPS_ONLY") return "📍";
  if (evidenceMode === "HEALTH_ONLY") return "🌿";
  if (serviceKey.includes("WATER")) return "💧";
  if (serviceKey.includes("FERTILIZER")) return "🌱";
  if (
    serviceKey.includes("FUNGICIDE") ||
    serviceKey.includes("PEST") ||
    serviceKey.includes("INSECT")
  ) {
    return "🛡️";
  }

  return "📸";
}

function getEvidenceTitle(evidenceMode: EvidenceMode, serviceKey: string) {
  if (evidenceMode === "GPS_ONLY") return "Evidence — GPS Verification";
  if (evidenceMode === "HEALTH_ONLY") return "Evidence — Health Check";
  if (evidenceMode === "PHOTO_BEFORE_AFTER") return `Evidence — ${getServiceLabel(serviceKey)}`;

  return "Evidence — Photo Update";
}

function getEvidenceHelper(evidenceMode: EvidenceMode, serviceKey: string) {
  if (evidenceMode === "GPS_ONLY") {
    return "Capture your current location at the assigned tree.";
  }

  if (evidenceMode === "HEALTH_ONLY") {
    return "Assess the tree health and provide optional notes.";
  }

  if (evidenceMode === "PHOTO_BEFORE_AFTER") {
    return `Upload before and after photos for ${getServiceLabel(serviceKey).toLowerCase()}.`;
  }

  return "Upload the current tree photo. Notes are optional.";
}
function getEvidenceRequirementLabel(evidenceMode: EvidenceMode, serviceKey?: string) {
  return getMissionRequirement(serviceKey || evidenceMode);
}

function getEvidenceRequirementDetail(evidenceMode: EvidenceMode, serviceKey: string) {
  return getMissionRule(serviceKey).gardenerInstruction;
}

function getRequiredSupplyLabel(serviceKey: string) {
  const items = getMissionInventoryItems(serviceKey);
  return items.length > 0 ? items.join(" / ") : "No supply required";
}

function parseQrValue(raw: string) {
  const value = raw.trim();

  if (!value) {
    return {
      treeId: "",
      treeCode: "",
    };
  }

  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/tree\/verify\/([^/?#]+)/i);

    const treeId =
      url.searchParams.get("tree_id") ||
      url.searchParams.get("treeId") ||
      url.searchParams.get("id") ||
      pathMatch?.[1] ||
      "";

    const treeCode =
      url.searchParams.get("tree_code") ||
      url.searchParams.get("treeCode") ||
      url.searchParams.get("code") ||
      "";

    const fallback = treeCode || treeId || value;

    return {
      treeId: treeId || (fallback.includes("-") && fallback.length > 20 ? fallback : ""),
      treeCode: treeCode || fallback,
    };
  } catch {
    const pathMatch = value.match(/\/tree\/verify\/([^/?#]+)/i);
    const fallback = pathMatch?.[1] || value;

    return {
      treeId: fallback.includes("-") && fallback.length > 20 ? fallback : "",
      treeCode: fallback,
    };
  }
}

export default function GardenerTasksPage() {
  const searchParams = useSearchParams();
  const requestedAssignmentId = searchParams.get("assignment_id") || "";
  const requestedTreeId = searchParams.get("tree_id") || "";
  const scannerRef = useRef<any>(null);

  const [profile, setProfile] = useState<Row | null>(null);
  const [caretaker, setCaretaker] = useState<Row | null>(null);

  const [assignments, setAssignments] = useState<Row[]>([]);
  const [taskLogs, setTaskLogs] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);

  const [tab, setTab] = useState<TaskTab>("ASSIGNED");
  const [selectedKey, setSelectedKey] = useState("");

  const [scanValue, setScanValue] = useState("");
  const [verifiedMap, setVerifiedMap] = useState<Record<string, VerifiedTree>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);

  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const [healthStatus, setHealthStatus] = useState("HEALTHY");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function resolveProfile() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) throw profileByIdError;

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileByEmailError) throw profileByEmailError;

    return profileById || profileByEmail || null;
  }

  async function loadData(keepSelectedKey?: string) {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveProfile();

      if (!currentProfile) {
        setMessage("Profile not found.");
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const email = String(currentProfile.email || "").trim().toLowerCase();

      const { data: caretakerByProfile, error: caretakerByProfileError } =
        await supabase
          .from("caretakers")
          .select("*")
          .eq("caretaker_profile_id", currentProfile.id)
          .maybeSingle();

      if (caretakerByProfileError) throw caretakerByProfileError;

      const { data: caretakerByEmail, error: caretakerByEmailError } =
        await supabase
          .from("caretakers")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

      if (caretakerByEmailError) throw caretakerByEmailError;

      const caretakerRow = caretakerByProfile || caretakerByEmail;

      if (!caretakerRow) {
        setMessage("Gardener profile not found.");
        setLoading(false);
        return;
      }

      if (statusOf(caretakerRow.status) !== "ACTIVE") {
        setMessage("Your gardener account is not ACTIVE.");
        setLoading(false);
        return;
      }

      setCaretaker(caretakerRow);

      const filters = [
        `caretaker_id.eq.${caretakerRow.id}`,
        caretakerRow.caretaker_profile_id
          ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}`
          : "",
      ].filter(Boolean);

      const [assignmentResult, taskResult] = await Promise.all([
        supabase
          .from("caretaker_assignments")
          .select("*")
          .or(filters.join(","))
          .order("created_at", { ascending: false }),
        supabase
          .from("caretaker_task_logs")
          .select("*")
          .or(filters.join(","))
          .order("created_at", { ascending: false }),
      ]);

      if (assignmentResult.error) throw assignmentResult.error;
      if (taskResult.error) throw taskResult.error;

      const assignmentRows = assignmentResult.data || [];
      const taskRows = taskResult.data || [];

      const operationRequestIds = unique([
        ...assignmentRows.map((row) => row.operation_request_id),
        ...taskRows.map((row) => row.operation_request_id),
      ]);

      let requestRows: Row[] = [];

      if (operationRequestIds.length > 0) {
        const { data, error } = await supabase
          .from("tree_operation_requests")
          .select("*")
          .in("id", operationRequestIds);

        if (error) throw error;
        requestRows = data || [];
      }

      const directTreeIds = unique([
        ...assignmentRows.map((row) => row.tree_id),
        ...taskRows.map((row) => row.tree_id),
        ...requestRows.map((row) => row.tree_id),
        requestedTreeId,
      ]);

      const groupIds = unique([
        ...assignmentRows.map((row) => row.group_id),
        ...taskRows.map((row) => row.group_id),
        ...requestRows.map((row) => row.group_id),
      ]);

      const [directTreeResult, groupTreeResult, groupResult] = await Promise.all([
        directTreeIds.length > 0
          ? supabase.from("trees").select("*").in("id", directTreeIds)
          : Promise.resolve({ data: [], error: null }),
        groupIds.length > 0
          ? supabase.from("trees").select("*").in("group_id", groupIds)
          : Promise.resolve({ data: [], error: null }),
        groupIds.length > 0
          ? supabase.from("tree_groups").select("*").in("id", groupIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (directTreeResult.error) throw directTreeResult.error;
      if (groupTreeResult.error) throw groupTreeResult.error;
      if (groupResult.error) throw groupResult.error;

      const allTrees = Array.from(
        new Map(
          [...(directTreeResult.data || []), ...(groupTreeResult.data || [])].map(
            (tree) => [String(tree.id), tree],
          ),
        ).values(),
      );

      const groupRows = groupResult.data || [];

      const customerIds = unique([
        ...assignmentRows.map((row) => row.customer_profile_id),
        ...taskRows.map((row) => row.customer_profile_id),
        ...requestRows.map((row) => row.customer_profile_id),
        ...requestRows.map((row) => row.profile_id),
        ...allTrees.map((row) => row.customer_profile_id),
        ...allTrees.map((row) => row.profile_id),
        ...groupRows.map((row) => row.customer_profile_id),
        ...groupRows.map((row) => row.profile_id),
      ]);

      let customerRows: Row[] = [];

      if (customerIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, email, phone")
          .in("id", customerIds);

        if (!error) customerRows = data || [];
      }

      setAssignments(assignmentRows);
      setTaskLogs(taskRows);
      setRequests(requestRows);
      setTrees(allTrees);
      setGroups(groupRows);
      setCustomers(customerRows);

      const nextSelected =
        keepSelectedKey ||
        requestedAssignmentId ||
        selectedKey ||
        assignmentRows[0]?.id ||
        "";

      if (nextSelected) setSelectedKey(String(nextSelected));

      setLoading(false);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load gardener tasks.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    return () => {
      stopCameraScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const workItems = useMemo<WorkItem[]>(() => {
    return assignments
      .map((assignment) => {
        const task =
          taskLogs.find(
            (row) => String(row.assignment_id || "") === String(assignment.id),
          ) ||
          taskLogs.find(
            (row) =>
              String(row.operation_request_id || "") ===
              String(assignment.operation_request_id || ""),
          ) ||
          null;

        const request = assignment.operation_request_id
          ? requestMap.get(String(assignment.operation_request_id)) || null
          : null;

        const treeId = task?.tree_id || assignment.tree_id || request?.tree_id || null;
        const tree = treeId ? treeMap.get(String(treeId)) || null : null;

        const groupId =
          task?.group_id ||
          assignment.group_id ||
          request?.group_id ||
          tree?.group_id ||
          null;
        const group = groupId ? groupMap.get(String(groupId)) || null : null;

        const customerId =
          task?.customer_profile_id ||
          assignment.customer_profile_id ||
          request?.customer_profile_id ||
          request?.profile_id ||
          tree?.customer_profile_id ||
          tree?.profile_id ||
          group?.customer_profile_id ||
          group?.profile_id ||
          null;

        const customer = customerId ? customerMap.get(String(customerId)) || null : null;

        const status = mergeStatus(
          task?.status,
          assignment.status,
          request?.assignment_status,
          request?.status,
        );

        const evidenceStatus = mergeStatus(
          task?.evidence_status,
          task?.status,
          assignment.status,
          request?.assignment_status,
        );

        const serviceKey = getServiceKey(assignment, task, request);
        const evidenceMode = getEvidenceMode(serviceKey);

        return {
          key: String(assignment.id),
          assignment,
          task,
          request,
          tree,
          group,
          customer,
          status,
          evidenceStatus,
          serviceKey,
          evidenceMode,
        };
      })
      .sort((a, b) => {
        const aDate = new Date(a.task?.created_at || a.assignment.created_at || 0).getTime();
        const bDate = new Date(b.task?.created_at || b.assignment.created_at || 0).getTime();

        return bDate - aDate;
      });
  }, [assignments, taskLogs, requestMap, treeMap, groupMap, customerMap]);

  const activeTask = useMemo(() => {
    return workItems.find((item) => item.status === "IN_PROGRESS") || null;
  }, [workItems]);

  const visibleItems = useMemo(() => {
    return workItems.filter((item) => item.status === tab);
  }, [workItems, tab]);

  const selected = useMemo(() => {
    return (
      workItems.find((item) => item.key === selectedKey) ||
      visibleItems[0] ||
      activeTask ||
      workItems[0] ||
      null
    );
  }, [workItems, selectedKey, visibleItems, activeTask]);

  useEffect(() => {
    if (activeTask && tab !== "IN_PROGRESS") {
      setTab("IN_PROGRESS");
    }
  }, [activeTask?.key]);

  useEffect(() => {
    if (!selectedKey && selected?.key) {
      setSelectedKey(selected.key);
    }
  }, [selected, selectedKey]);

  const verifiedTree = selected ? verifiedMap[selected.key] || null : null;
  const isVerified = !!verifiedTree;

  const activeTaskBlocksStart =
    !!activeTask && !!selected && activeTask.key !== selected.key;

  const stats = useMemo(() => {
    return {
      assigned: workItems.filter((item) => item.status === "ASSIGNED").length,
      inProgress: workItems.filter((item) => item.status === "IN_PROGRESS").length,
    };
  }, [workItems]);

  function resetEvidenceForm() {
    setCurrentPhoto(null);
    setBeforePhoto(null);
    setAfterPhoto(null);
    setLatitude("");
    setLongitude("");
    setGpsAccuracy(null);
    setHealthStatus("HEALTHY");
    setNotes("");
  }

  function resolveCustomerProfileId(item: WorkItem) {
    return (
      item.assignment.customer_profile_id ||
      item.task?.customer_profile_id ||
      item.request?.customer_profile_id ||
      item.request?.profile_id ||
      item.tree?.customer_profile_id ||
      item.tree?.profile_id ||
      item.group?.customer_profile_id ||
      item.group?.profile_id ||
      null
    );
  }

  function resolveGroupId(item: WorkItem, matchedTree?: VerifiedTree | null) {
    return (
      item.assignment.group_id ||
      item.task?.group_id ||
      item.request?.group_id ||
      matchedTree?.groupId ||
      item.tree?.group_id ||
      item.group?.id ||
      null
    );
  }

  function findTreeByScan(item: WorkItem, raw: string): VerifiedTree | null {
    const parsed = parseQrValue(raw);
    const scannedId = parsed.treeId.trim().toLowerCase();
    const scannedCode = parsed.treeCode.trim().toLowerCase();

    const expectedTreeId = String(
      item.tree?.id || item.assignment.tree_id || item.request?.tree_id || "",
    )
      .trim()
      .toLowerCase();

    const expectedTreeCode = String(
      item.tree?.tree_code ||
        item.assignment.tree_code ||
        item.request?.tree_code ||
        "",
    )
      .trim()
      .toLowerCase();

    if (expectedTreeId || expectedTreeCode) {
      const matched =
        Boolean(scannedId && expectedTreeId && scannedId === expectedTreeId) ||
        Boolean(scannedCode && expectedTreeCode && scannedCode === expectedTreeCode);

      if (!matched) return null;

      return {
        treeId: String(item.tree?.id || item.assignment.tree_id || item.request?.tree_id),
        treeCode: String(
          item.tree?.tree_code ||
            item.assignment.tree_code ||
            item.request?.tree_code ||
            parsed.treeCode,
        ),
        treeName: getTreeName(item.tree),
        groupId: item.tree?.group_id || item.assignment.group_id || item.request?.group_id || null,
      };
    }

    const assignedGroupId = String(
      item.assignment.group_id || item.task?.group_id || item.request?.group_id || item.group?.id || "",
    );

    if (!assignedGroupId) return null;

    const matchedGroupTree = trees.find((tree) => {
      const treeId = String(tree.id || "").trim().toLowerCase();
      const treeCode = String(tree.tree_code || "").trim().toLowerCase();
      const sameGroup = String(tree.group_id || "") === assignedGroupId;

      return (
        sameGroup &&
        ((scannedId && scannedId === treeId) ||
          (scannedCode && scannedCode === treeCode))
      );
    });

    if (!matchedGroupTree) return null;

    return {
      treeId: String(matchedGroupTree.id),
      treeCode: String(matchedGroupTree.tree_code || parsed.treeCode || matchedGroupTree.id),
      treeName: getTreeName(matchedGroupTree),
      groupId: matchedGroupTree.group_id || assignedGroupId,
    };
  }

  async function saveQrAudit(item: WorkItem, matchedTree: VerifiedTree) {
    if (!caretaker) return;

    try {
      await supabase.from("tree_verifications").insert({
        assignment_id: item.assignment.id,
        operation_request_id: item.assignment.operation_request_id || item.request?.id || null,
        tree_id: matchedTree.treeId,
        customer_profile_id: resolveCustomerProfileId(item),
        caretaker_id: caretaker.id,
        verified_tree_code: matchedTree.treeCode,
        verification_method: "QR_CAMERA",
        status: "VERIFIED",
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Optional tree_verifications audit skipped", error);
    }
  }

  async function verifyTree(raw?: string) {
    if (!selected) return;

    const value = String(raw || scanValue || "").trim();

    if (!value) {
      setMessage("Scan or enter tree QR / tree code first.");
      return;
    }

    const matchedTree = findTreeByScan(selected, value);

    if (!matchedTree) {
      setVerifiedMap((current) => {
        const next = { ...current };
        delete next[selected.key];
        return next;
      });
      setMessage("Wrong Tree / Tree mismatch. Evidence upload is blocked for this task.");
      return;
    }

    setVerifiedMap((current) => ({
      ...current,
      [selected.key]: matchedTree,
    }));

    setMessage(`Tree Verified: ${matchedTree.treeName}.`);
    await saveQrAudit(selected, matchedTree);
  }

  async function startCameraScanner() {
    if (!selected) return;

    setMessage("");

    try {
      setScannerOpen(true);
      setScannerRunning(true);

      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = `gardener-task-scanner-${selected.key}`;
      const scanner = new Html5Qrcode(scannerId);

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          setScanValue(decodedText);
          await verifyTree(decodedText);
          await stopCameraScanner();
        },
        () => undefined,
      );
    } catch (error: any) {
      setScannerRunning(false);
      setMessage(error?.message || "Unable to open QR scanner. Use manual input.");
    }
  }

  async function stopCameraScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (error) {
      console.warn("QR scanner stop skipped", error);
    } finally {
      scannerRef.current = null;
      setScannerRunning(false);
      setScannerOpen(false);
    }
  }

  async function ensureTaskLogForStart(item: WorkItem, now: string) {
    if (!caretaker) throw new Error("Caretaker not loaded.");

    if (item.task?.id) {
      const { error } = await supabase
        .from("caretaker_task_logs")
        .update({
          status: "IN_PROGRESS",
          evidence_status: "PENDING",
          started_at: item.task.started_at || now,
          updated_at: now,
        })
        .eq("id", item.task.id);

      if (error) throw error;

      return item.task.id as string;
    }

    const { data, error } = await supabase
      .from("caretaker_task_logs")
      .insert({
        assignment_id: item.assignment.id,
        operation_request_id: item.assignment.operation_request_id || item.request?.id || null,
        tree_id: item.assignment.tree_id || item.request?.tree_id || null,
        group_id: item.assignment.group_id || item.request?.group_id || item.tree?.group_id || null,
        customer_profile_id: resolveCustomerProfileId(item),
        caretaker_id: caretaker.id,
        caretaker_profile_id: caretaker.caretaker_profile_id || null,
        task_type: item.serviceKey,
        source_type: item.serviceKey,
        status: "IN_PROGRESS",
        evidence_status: "PENDING",
        notes: "Gardener started work.",
        started_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to create task log.");
    }

    return data.id as string;
  }

  async function startWork() {
    if (!selected || !caretaker) return;

    if (activeTaskBlocksStart) {
      setMessage("You already have one active task. Submit that task before starting another.");
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();

    try {
      await ensureTaskLogForStart(selected, now);

      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "IN_PROGRESS",
          started_at: selected.assignment.started_at || now,
          updated_at: now,
        })
        .eq("id", selected.assignment.id);

      if (assignmentError) throw assignmentError;

      const operationRequestId = selected.assignment.operation_request_id || selected.request?.id;

      if (operationRequestId) {
        const { error: requestError } = await supabase
          .from("tree_operation_requests")
          .update({
            status: "IN_PROGRESS",
            assignment_status: "IN_PROGRESS",
            updated_at: now,
          })
          .eq("id", operationRequestId);

        if (requestError) throw requestError;
      }

      setTab("IN_PROGRESS");
      setSelectedKey(selected.key);
      setMessage("Work started. Verify tree QR, then submit the required evidence.");
      await loadData(selected.key);
    } catch (error: any) {
      setMessage(error?.message || "Failed to start work.");
    } finally {
      setSaving(false);
    }
  }

  function useCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("GPS is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setGpsAccuracy(position.coords.accuracy || null);
        setMessage("GPS location captured.");
      },
      () => {
        setMessage("Unable to capture GPS location. You may enter it manually.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      },
    );
  }

  async function uploadEvidenceFile(file: File, folder: "current" | "before" | "after") {
    if (!caretaker) throw new Error("Caretaker profile not found.");
    if (!profile) throw new Error("Profile not found.");
    if (!selected) throw new Error("Task not selected.");

    const ext = file.name.split(".").pop() || "jpg";
    const ownerProfileId = caretaker.caretaker_profile_id || profile.id;

    if (!ownerProfileId) {
      throw new Error("Storage owner profile id not found.");
    }

    const filePath = `${ownerProfileId}/${folder}/${selected.assignment.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const upload = await supabase.storage.from("tree-evidence").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (upload.error) throw upload.error;

    const { data } = supabase.storage.from("tree-evidence").getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function ensureTaskLogForSubmit(item: WorkItem, now: string) {
    if (!caretaker) throw new Error("Caretaker not loaded.");

    if (item.task?.id) return item.task.id as string;

    const { data, error } = await supabase
      .from("caretaker_task_logs")
      .insert({
        assignment_id: item.assignment.id,
        operation_request_id: item.assignment.operation_request_id || item.request?.id || null,
        tree_id: item.assignment.tree_id || item.request?.tree_id || null,
        group_id: item.assignment.group_id || item.request?.group_id || item.tree?.group_id || null,
        customer_profile_id: resolveCustomerProfileId(item),
        caretaker_id: caretaker.id,
        caretaker_profile_id: caretaker.caretaker_profile_id || null,
        task_type: item.serviceKey,
        source_type: item.serviceKey,
        status: "IN_PROGRESS",
        evidence_status: "PENDING",
        notes: "Gardener field work in progress.",
        started_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to create task log before evidence submit.");
    }

    return data.id as string;
  }

  function validateEvidence() {
    if (!selected) return "Select a task first.";
    if (selected.status !== "IN_PROGRESS") return "Start work before submitting evidence.";
    if (!isVerified) return "Verify tree QR before submitting evidence.";
    if (selected.evidenceStatus === "SUBMITTED") return "This task already has submitted evidence.";

    if (selected.evidenceMode === "GPS_ONLY") {
      if (!latitude.trim() || !longitude.trim()) {
        return "GPS latitude and longitude are required.";
      }

      if (Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
        return "Latitude and longitude must be valid numbers.";
      }
    }

    if (selected.evidenceMode === "PHOTO_CURRENT_ONLY") {
      if (!currentPhoto) return "Current photo is required.";
    }

    if (selected.evidenceMode === "PHOTO_BEFORE_AFTER") {
      if (!beforePhoto) return "Before photo is required.";
      if (!afterPhoto) return "After photo is required.";
    }

    if (selected.evidenceMode === "HEALTH_ONLY") {
      if (!healthStatus.trim()) return "Health status is required.";
    }

    return "";
  }

  function getSubmissionCore(taskLogId: string) {
    if (!selected || !caretaker || !verifiedTree) {
      throw new Error("Task, caretaker, or verified tree not loaded.");
    }

    const operationRequestId = selected.assignment.operation_request_id || selected.request?.id;
    const customerProfileId = resolveCustomerProfileId(selected);
    const groupId = resolveGroupId(selected, verifiedTree);

    if (!selected.assignment.id) throw new Error("Missing assignment_id.");
    if (!operationRequestId) throw new Error("Missing operation_request_id.");
    if (!verifiedTree.treeId) throw new Error("Missing verified tree_id.");
    if (!customerProfileId) throw new Error("Missing customer_profile_id.");
    if (!caretaker.id) throw new Error("Missing caretaker_id.");

    return {
      assignment_id: selected.assignment.id,
      operation_request_id: operationRequestId,
      tree_id: verifiedTree.treeId,
      group_id: groupId,
      customer_profile_id: customerProfileId,
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      task_log_id: taskLogId,
    };
  }

  async function getExistingRelevantEvidenceCount() {
    if (!selected) return 0;

    if (selected.evidenceMode === "GPS_ONLY") {
      const { count, error } = await supabase
        .from("tree_gps_logs")
        .select("id", { count: "exact", head: true })
        .eq("assignment_id", selected.assignment.id);

      if (error) throw error;

      return count || 0;
    }

    if (selected.evidenceMode === "HEALTH_ONLY") {
      const { count, error } = await supabase
        .from("tree_health_reports")
        .select("id", { count: "exact", head: true })
        .eq("assignment_id", selected.assignment.id);

      if (error) throw error;

      return count || 0;
    }

    const { count, error } = await supabase
      .from("tree_photo_updates")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", selected.assignment.id);

    if (error) throw error;

    return count || 0;
  }

  async function rollbackEvidence(inserted: InsertedEvidenceIds) {
    try {
      if (inserted.photoIds.length > 0) {
        await supabase.from("tree_photo_updates").delete().in("id", inserted.photoIds);
      }

      if (inserted.gpsIds.length > 0) {
        await supabase.from("tree_gps_logs").delete().in("id", inserted.gpsIds);
      }

      if (inserted.healthIds.length > 0) {
        await supabase.from("tree_health_reports").delete().in("id", inserted.healthIds);
      }
    } catch (error) {
      console.error("Evidence rollback skipped or failed:", error);
    }
  }

  async function syncSubmitted(now: string, taskLogId: string, treeId: string, groupId: string | null) {
    if (!selected) throw new Error("Task not selected.");

    const { error: taskError } = await supabase
      .from("caretaker_task_logs")
      .update({
        tree_id: treeId,
        group_id: groupId,
        status: "SUBMITTED",
        evidence_status: "SUBMITTED",
        notes: notes || selected.task?.notes || "Evidence submitted.",
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", taskLogId);

    if (taskError) throw new Error(`caretaker_task_logs sync failed: ${taskError.message}`);

    const assignmentUpdate: Row = {
      group_id: selected.assignment.group_id || groupId,
      status: "SUBMITTED",
      submitted_at: now,
      updated_at: now,
    };

    if (selected.assignment.tree_id || selected.request?.tree_id) {
      assignmentUpdate.tree_id = treeId;
    }

    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update(assignmentUpdate)
      .eq("id", selected.assignment.id);

    if (assignmentError) {
      throw new Error(`caretaker_assignments sync failed: ${assignmentError.message}`);
    }

    const requestUpdate: Row = {
      group_id: selected.request?.group_id || selected.assignment.group_id || groupId,
      status: "SUBMITTED",
      assignment_status: "SUBMITTED",
      updated_at: now,
    };

    if (selected.request?.tree_id || selected.assignment.tree_id) {
      requestUpdate.tree_id = treeId;
    }

    const operationRequestId = selected.assignment.operation_request_id || selected.request?.id;

    if (!operationRequestId) {
      throw new Error("Missing operation_request_id during submit sync.");
    }

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update(requestUpdate)
      .eq("id", operationRequestId);

    if (requestError) {
      throw new Error(`tree_operation_requests sync failed: ${requestError.message}`);
    }
  }

  async function submitEvidence() {
    if (saving) return;

    setSaving(true);
    setMessage("");

    const inserted: InsertedEvidenceIds = {
      photoIds: [],
      gpsIds: [],
      healthIds: [],
    };

    try {
      const validationError = validateEvidence();
      if (validationError) throw new Error(validationError);

      const duplicateCount = await getExistingRelevantEvidenceCount();

      if (duplicateCount > 0) {
        throw new Error("Evidence for this task was already submitted. Duplicate submission blocked.");
      }

      const now = new Date().toISOString();
      const taskLogId = await ensureTaskLogForSubmit(selected as WorkItem, now);
      const core = getSubmissionCore(taskLogId);

      if (selected?.evidenceMode === "GPS_ONLY") {
        const mapUrl = `https://maps.google.com/?q=${Number(latitude)},${Number(longitude)}`;

        const { data, error } = await supabase
          .from("tree_gps_logs")
          .insert({
            ...core,
            latitude: Number(latitude),
            longitude: Number(longitude),
            accuracy_meters: gpsAccuracy,
            gps_url: mapUrl,
            map_url: mapUrl,
            location_note: notes || null,
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          throw new Error(`tree_gps_logs insert failed: ${error?.message || "No evidence id returned."}`);
        }

        inserted.gpsIds.push(data.id);
      }

      if (selected?.evidenceMode === "PHOTO_CURRENT_ONLY") {
        if (!currentPhoto) throw new Error("Current photo is required.");

        const currentPhotoUrl = await uploadEvidenceFile(currentPhoto, "current");

        const { data, error } = await supabase
          .from("tree_photo_updates")
          .insert({
            ...core,
            photo_url: currentPhotoUrl,
            image_url: currentPhotoUrl,
            before_photo_url: null,
            after_photo_url: null,
            caption: getServiceLabel(selected.serviceKey),
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          throw new Error(`tree_photo_updates insert failed: ${error?.message || "No evidence id returned."}`);
        }

        inserted.photoIds.push(data.id);
      }

      if (selected?.evidenceMode === "PHOTO_BEFORE_AFTER") {
        if (!beforePhoto) throw new Error("Before photo is required.");
        if (!afterPhoto) throw new Error("After photo is required.");

        const beforePhotoUrl = await uploadEvidenceFile(beforePhoto, "before");
        const afterPhotoUrl = await uploadEvidenceFile(afterPhoto, "after");

        const { data, error } = await supabase
          .from("tree_photo_updates")
          .insert({
            ...core,
            photo_url: afterPhotoUrl || beforePhotoUrl,
            image_url: afterPhotoUrl || beforePhotoUrl,
            before_photo_url: beforePhotoUrl,
            after_photo_url: afterPhotoUrl,
            caption: getServiceLabel(selected.serviceKey),
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          throw new Error(`tree_photo_updates insert failed: ${error?.message || "No evidence id returned."}`);
        }

        inserted.photoIds.push(data.id);
      }

      if (selected?.evidenceMode === "HEALTH_ONLY") {
        const severity =
          healthStatus === "CRITICAL"
            ? "CRITICAL"
            : healthStatus === "TREATMENT_REQUIRED" || healthStatus === "NEEDS_MONITORING"
              ? "ATTENTION"
              : null;

        const { data, error } = await supabase
          .from("tree_health_reports")
          .insert({
            ...core,
            health_status: healthStatus,
            issue_severity: severity,
            issue_summary: notes || null,
            report_notes: notes || null,
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          throw new Error(`tree_health_reports insert failed: ${error?.message || "No evidence id returned."}`);
        }

        inserted.healthIds.push(data.id);
      }

      await syncSubmitted(now, taskLogId, core.tree_id, core.group_id);

      setMessage("Task Submitted Successfully. Waiting for Admin Review.");
      resetEvidenceForm();
      setVerifiedMap((current) => {
        const next = { ...current };
        if (selected?.key) delete next[selected.key];
        return next;
      });
      setScanValue("");
      setTab("IN_PROGRESS");
      await loadData(selected?.key);
    } catch (error: any) {
      await rollbackEvidence(inserted);
      setMessage(`${error?.message || "Submit evidence failed."} Evidence from this failed attempt was rolled back.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#03130d] px-4 py-5 text-white">
      <div className="mx-auto max-w-md space-y-5">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <Link href="/gardener/dashboard" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xl" aria-label="Open gardener dashboard">
              ☰
            </Link>
            <div className="text-center">
              <h1 className="text-lg font-black">Today&apos;s Mission</h1>
              <p className="text-xs font-semibold text-white/55">Mission Queue</p>
            </div>
            <button type="button" onClick={() => loadData(selected?.key)} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xl" aria-label="Refresh mission notifications">
              🔔
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-3 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab("ASSIGNED")}
              className={`rounded-xl px-4 py-3 text-sm font-black ${
                tab === "ASSIGNED" ? "bg-[#5bb64a] text-white" : "bg-white/10 text-white/70"
              }`}
            >
              Assigned ({stats.assigned})
            </button>
            <button
              onClick={() => setTab("IN_PROGRESS")}
              className={`rounded-xl px-4 py-3 text-sm font-black ${
                tab === "IN_PROGRESS" ? "bg-[#5bb64a] text-white" : "bg-white/10 text-white/70"
              }`}
            >
              In Progress ({stats.inProgress})
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/55">
                Loading tasks...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-white/55">
                No {tab.replaceAll("_", " ").toLowerCase()} tasks.
              </div>
            ) : (
              visibleItems.map((item) => (
                <TaskCard
                  key={item.key}
                  item={item}
                  active={selected?.key === item.key}
                  onClick={() => {
                    setSelectedKey(item.key);
                    stopCameraScanner();
                    resetEvidenceForm();
                    setScanValue("");
                  }}
                />
              ))
            )}
          </div>
        </section>

        {selected && (
          <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedKey("");
                  stopCameraScanner();
                  resetEvidenceForm();
                  setScanValue("");
                }}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                ←
              </button>
              <h2 className="text-base font-black">Mission Details</h2>
              <StatusBadge status={selected.status} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black">Tree Identity</p>

              <div className="mt-3 flex gap-3">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 text-3xl">
                  🌳
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-black text-[#ffe49a]">
                    {verifiedTree?.treeCode || selected.tree?.tree_code || "Forest-level task"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/75">
                    {verifiedTree?.treeName || getTreeName(selected.tree)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {getForestName(selected.group, selected.tree)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Owner: {getOwnerName(selected.customer)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={scannerOpen ? stopCameraScanner : startCameraScanner}
                  disabled={scannerRunning && !scannerOpen}
                  className="w-full rounded-xl border border-[#5bb64a]/50 bg-[#5bb64a]/10 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {scannerOpen ? "Close QR Scanner" : "▦ Verify Tree (QR)"}
                </button>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    placeholder="Manual tree code / QR URL"
                    className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    type="button"
                    onClick={() => verifyTree()}
                    className="rounded-xl bg-[#d9b45f] px-4 py-3 text-sm font-black text-[#071f16]"
                  >
                    Verify
                  </button>
                </div>

                {scannerOpen && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-black/30 p-3">
                    <div
                      id={`gardener-task-scanner-${selected.key}`}
                      className="min-h-[260px] overflow-hidden rounded-xl"
                    />
                    <p className="mt-2 text-xs font-bold text-white/45">
                      Point camera at the physical tree QR tag.
                    </p>
                  </div>
                )}

                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    isVerified
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-red-400/30 bg-red-500/10 text-red-200"
                  }`}
                >
                  {isVerified ? "Tree Verified" : "Tree not verified — evidence blocked"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl">
                  {getServiceIcon(selected.evidenceMode, selected.serviceKey)}
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                    Mission Type
                  </p>
                  <p className="mt-1 text-sm font-black text-white">
                    {getServiceLabel(selected.serviceKey)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/55">
                    {getEvidenceRequirementLabel(selected.evidenceMode, selected.serviceKey)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffe49a]/75">
                  Mission Requirement
                </p>
                <p className="mt-1 text-sm font-black text-[#ffe49a]">
                  {getEvidenceRequirementLabel(selected.evidenceMode, selected.serviceKey)}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/60">
                  {getEvidenceRequirementDetail(selected.evidenceMode, selected.serviceKey)}
                </p>
              </div>

              {missionNeedsInventory(selected.serviceKey) && (
                <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/75">
                    Required Supply
                  </p>
                  <p className="mt-1 text-sm font-black text-emerald-100">
                    {getRequiredSupplyLabel(selected.serviceKey)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/60">
                    Confirm supply used. No inventory deduction or finance logic is performed here.
                  </p>
                </div>
              )}

              {selected.status === "ASSIGNED" && (
                <button
                  type="button"
                  onClick={startWork}
                  disabled={saving || activeTaskBlocksStart}
                  className="mt-4 w-full rounded-xl bg-[#5bb64a] px-4 py-4 text-base font-black text-white disabled:opacity-40"
                >
                  {activeTaskBlocksStart
                    ? "Finish Active Task First"
                    : saving
                      ? "Starting..."
                      : "Start Work"}
                </button>
              )}
            </div>

            {selected.status === "IN_PROGRESS" && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                  Required Evidence
                </p>
                <p className="mt-1 text-sm font-black">
                  {getEvidenceTitle(selected.evidenceMode, selected.serviceKey)}
                </p>

                <div className="mt-3 rounded-xl border border-blue-300/25 bg-blue-500/10 p-3 text-xs font-semibold text-blue-100">
                  {getEvidenceHelper(selected.evidenceMode, selected.serviceKey)}
                </div>

                {selected.evidenceMode === "GPS_ONLY" && (
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      className="w-full rounded-xl bg-[#5bb64a] px-4 py-3 text-sm font-black text-white"
                    >
                      📍 Capture GPS Location
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                        placeholder="Latitude"
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                      />
                      <input
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                        placeholder="Longitude"
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes optional..."
                      className="min-h-[90px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                )}

                {selected.evidenceMode === "PHOTO_CURRENT_ONLY" && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-black text-white">
                      Current Photo *
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => setCurrentPhoto(event.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white"
                    />

                    <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/25 bg-black/20 text-2xl">
                      {currentPhoto ? "✅ Current photo selected" : "📷"}
                    </div>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes optional..."
                      className="min-h-[90px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                )}

                {selected.evidenceMode === "PHOTO_BEFORE_AFTER" && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-black text-white">
                      Before Photo *
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => setBeforePhoto(event.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white"
                    />

                    <div className="grid h-20 place-items-center rounded-xl border border-dashed border-white/25 bg-black/20 text-sm font-bold text-white/70">
                      {beforePhoto ? "✅ Before photo selected" : "📷 Before"}
                    </div>

                    <label className="block text-sm font-black text-white">
                      After Photo *
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => setAfterPhoto(event.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white"
                    />

                    <div className="grid h-20 place-items-center rounded-xl border border-dashed border-white/25 bg-black/20 text-sm font-bold text-white/70">
                      {afterPhoto ? "✅ After photo selected" : "📷 After"}
                    </div>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes optional..."
                      className="min-h-[90px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                )}

                {selected.evidenceMode === "HEALTH_ONLY" && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-black text-white">
                      Health Status *
                    </label>

                    <select
                      value={healthStatus}
                      onChange={(event) => setHealthStatus(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                    >
                      <option value="HEALTHY">Healthy</option>
                      <option value="NEEDS_MONITORING">Needs Monitoring</option>
                      <option value="TREATMENT_REQUIRED">Treatment Required</option>
                      <option value="CRITICAL">Critical</option>
                    </select>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes optional..."
                      className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitEvidence}
                  disabled={saving || !isVerified}
                  className="mt-4 w-full rounded-xl bg-[#5bb64a] px-4 py-4 text-base font-black text-white disabled:opacity-40"
                >
                  {saving ? "Submitting..." : "Submit Evidence"}
                </button>
              </div>
            )}

            {selected.status === "SUBMITTED" && (
              <div className="mt-4 rounded-2xl border border-purple-300/30 bg-purple-500/10 p-4 text-center text-sm font-bold text-purple-100">
                Task Submitted Successfully.
                <br />
                Waiting for Admin Review.
              </div>
            )}

            {selected.status === "COMPLETED" && (
              <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-center text-sm font-bold text-emerald-100">
                Completed by Admin approval.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function TaskCard({
  item,
  active,
  onClick,
}: {
  item: WorkItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left shadow-xl transition ${
        active
          ? "border-[#5bb64a]/70 bg-[#5bb64a]/15"
          : "border-white/10 bg-black/20 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">
          {getServiceIcon(item.evidenceMode, item.serviceKey)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">
            {getServiceLabel(item.serviceKey)}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-[#ffe49a]">
            {getEvidenceRequirementLabel(item.evidenceMode, item.serviceKey)}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-white/70">
            Tree: {item.tree?.tree_code || item.tree?.id || "Forest-level task"}
          </p>
          <p className="mt-1 truncate text-xs text-white/50">
            {getForestName(item.group, item.tree)}
          </p>
        </div>

        <span className="text-2xl text-white/60">›</span>
      </div>

      <span
        className={`mt-3 inline-flex rounded-md px-2 py-1 text-[10px] font-black ${
          item.status === "IN_PROGRESS"
            ? "bg-blue-500/20 text-blue-100"
            : "bg-yellow-500/20 text-yellow-100"
        }`}
      >
        {item.status.replaceAll("_", " ")}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  let className = "bg-yellow-500/20 text-yellow-100";

  if (status === "IN_PROGRESS") className = "bg-blue-500/20 text-blue-100";
  if (status === "SUBMITTED") className = "bg-purple-500/20 text-purple-100";
  if (status === "COMPLETED") className = "bg-emerald-500/20 text-emerald-100";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-black ${className}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}