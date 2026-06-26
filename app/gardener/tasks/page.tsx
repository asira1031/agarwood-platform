"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

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
  service: string;
};

type VerifiedTree = {
  treeId: string;
  treeCode: string;
  treeName: string;
  groupId: string | null;
};

type InsertedEvidenceIds = {
  photoIds: string[];
  gpsIds: string[];
  healthIds: string[];
};

type ExistingEvidenceCounts = {
  photos: number;
  gps: number;
  health: number;
  total: number;
};

const CLOSED_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"];
const SUBMIT_LOCK_STATUSES = ["SUBMITTED", "COMPLETED", "CANCELLED", "REJECTED", "FAILED"];

const SERVICE_LABELS: Record<string, string> = {
  PHOTO_UPDATE: "Photo Update",
  GPS_VERIFICATION: "GPS Verification",
  GPS_UPDATE: "GPS Verification",
  HEALTH_CHECK: "Health Check",
  HEALTH_REPORT: "Health Report",
  WATERING_SERVICE: "Watering Service",
  FERTILIZER: "Apply Fertilizer",
  APPLY_FERTILIZER: "Apply Fertilizer",
  FUNGICIDE: "Apply Fungicide",
  APPLY_FUNGICIDE: "Apply Fungicide",
  INSECTICIDE: "Apply Insecticide",
  APPLY_INSECTICIDE: "Apply Insecticide",
  PRUNING: "Pruning",
  PEST_CONTROL: "Pest Control",
  CARE_PROGRAM: "Care Program",
  TREE_OPERATION: "Tree Operation",
};

function normalize(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function statusOf(value: any) {
  return normalize(value || "ASSIGNED");
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

function mergeStatuses(...values: any[]) {
  const statuses = values.map(statusOf).filter(Boolean);

  if (statuses.some((status) => status === "COMPLETED")) return "COMPLETED";
  if (statuses.some((status) => status === "REJECTED")) return "REJECTED";
  if (statuses.some((status) => status === "REWORK" || status === "REWORK_REQUESTED")) return "REWORK_REQUESTED";
  if (statuses.some((status) => status === "SUBMITTED")) return "SUBMITTED";
  if (statuses.some((status) => status === "IN_PROGRESS" || status === "STARTED")) return "IN_PROGRESS";
  if (statuses.some((status) => status === "ASSIGNED")) return "ASSIGNED";
  if (statuses.some((status) => status === "PENDING" || status === "REQUESTED" || status === "PAID")) return "PENDING";

  return statuses[0] || "ASSIGNED";
}

function serviceOfRaw(...values: any[]) {
  const joined = values
    .map((value) => String(value || ""))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (joined.includes("PHOTO")) return "PHOTO_UPDATE";
  if (joined.includes("GPS")) return "GPS_VERIFICATION";
  if (joined.includes("HEALTH")) return "HEALTH_CHECK";
  if (joined.includes("WATER")) return "WATERING_SERVICE";
  if (joined.includes("FERTILIZER")) return "FERTILIZER";
  if (joined.includes("FUNGICIDE")) return "FUNGICIDE";
  if (joined.includes("INSECT")) return "INSECTICIDE";
  if (joined.includes("PRUN")) return "PRUNING";
  if (joined.includes("PEST")) return "PEST_CONTROL";
  if (joined.includes("CARE_PROGRAM") || joined.includes("CARE PROGRAM") || joined.includes("MONTHLY") || joined.includes("WEEK")) {
    return "CARE_PROGRAM";
  }

  return normalize(values.find(Boolean) || "TREE_OPERATION") || "TREE_OPERATION";
}

function serviceLabel(service: string) {
  return SERVICE_LABELS[service] || service.replaceAll("_", " ");
}

function requiresBeforeAfter(service: string) {
  return [
    "WATERING_SERVICE",
    "FERTILIZER",
    "FUNGICIDE",
    "INSECTICIDE",
    "PRUNING",
    "PEST_CONTROL",
    "CARE_PROGRAM",
  ].includes(service);
}

function parseScannedTreeValue(raw: string) {
  const value = raw.trim();
  if (!value) return { treeId: "", treeCode: "" };

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

function treeDisplayName(tree: Row | null | undefined) {
  return tree?.custom_name || tree?.display_name || tree?.tree_name || tree?.name || tree?.tree_code || "Assigned Tree";
}

function groupDisplayName(group: Row | null | undefined, tree?: Row | null) {
  return group?.forest_name || group?.group_name || tree?.tree_group_name || "Single Tree";
}

function customerDisplayName(customer: Row | null | undefined) {
  return customer?.full_name || customer?.display_name || customer?.email || "Customer";
}

export default function GardenerTasksPage() {
  const searchParams = useSearchParams();
  const requestedAssignmentId = searchParams.get("assignment_id") || "";
  const requestedTreeId = searchParams.get("tree_id") || "";

  const [profile, setProfile] = useState<Row | null>(null);
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [photoEvidence, setPhotoEvidence] = useState<Row[]>([]);
  const [gpsEvidence, setGpsEvidence] = useState<Row[]>([]);
  const [healthEvidence, setHealthEvidence] = useState<Row[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [verifiedMap, setVerifiedMap] = useState<Record<string, VerifiedTree>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const scannerRef = useRef<any>(null);
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [healthStatus, setHealthStatus] = useState("HEALTHY");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("ACTIVE");
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

    const { data: byId } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("email", email)
      .maybeSingle();

    return byId || byEmail || null;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveProfile();

    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: caretakerByProfile, error: caretakerByProfileError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("caretaker_profile_id", currentProfile.id)
      .maybeSingle();

    if (caretakerByProfileError) {
      setMessage(caretakerByProfileError.message);
      setLoading(false);
      return;
    }

    const { data: caretakerByEmail, error: caretakerByEmailError } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", String(currentProfile.email || ""))
      .maybeSingle();

    if (caretakerByEmailError) {
      setMessage(caretakerByEmailError.message);
      setLoading(false);
      return;
    }

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
      caretakerRow.caretaker_profile_id ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}` : "",
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

    if (assignmentResult.error) {
      setMessage(assignmentResult.error.message);
      setLoading(false);
      return;
    }

    if (taskResult.error) {
      setMessage(taskResult.error.message);
      setLoading(false);
      return;
    }

    const assignmentRows = assignmentResult.data || [];
    const taskRows = taskResult.data || [];

    const requestIds = unique([
      ...assignmentRows.map((row) => row.operation_request_id),
      ...taskRows.map((row) => row.operation_request_id),
    ]);

    let requestRows: Row[] = [];
    if (requestIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", requestIds);

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

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

    if (directTreeResult.error) {
      setMessage(directTreeResult.error.message);
      setLoading(false);
      return;
    }

    if (groupTreeResult.error) {
      setMessage(groupTreeResult.error.message);
      setLoading(false);
      return;
    }

    if (groupResult.error) {
      setMessage(groupResult.error.message);
      setLoading(false);
      return;
    }

    const combinedTrees = Array.from(
      new Map([...(directTreeResult.data || []), ...(groupTreeResult.data || [])].map((tree) => [String(tree.id), tree])).values(),
    );

    const groupRows = groupResult.data || [];

    const customerIds = unique([
      ...assignmentRows.map((row) => row.customer_profile_id),
      ...taskRows.map((row) => row.customer_profile_id),
      ...requestRows.map((row) => row.customer_profile_id),
      ...requestRows.map((row) => row.profile_id),
      ...combinedTrees.map((row) => row.customer_profile_id),
      ...combinedTrees.map((row) => row.profile_id),
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

    const assignmentIds = unique(assignmentRows.map((row) => row.id));

    const [photoResult, gpsResult, healthResult] = await Promise.all([
      assignmentIds.length > 0
        ? supabase.from("tree_photo_updates").select("*").in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length > 0
        ? supabase.from("tree_gps_logs").select("*").in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length > 0
        ? supabase.from("tree_health_reports").select("*").in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    setAssignments(assignmentRows);
    setTasks(taskRows);
    setRequests(requestRows);
    setTrees(combinedTrees);
    setGroups(groupRows);
    setCustomers(customerRows);
    setPhotoEvidence(photoResult.data || []);
    setGpsEvidence(gpsResult.data || []);
    setHealthEvidence(healthResult.data || []);

    setSelectedKey((current) => {
      if (requestedAssignmentId && assignmentRows.some((row) => String(row.id) === requestedAssignmentId)) {
        return requestedAssignmentId;
      }

      if (current && assignmentRows.some((row) => String(row.id) === current)) {
        return current;
      }

      return String(assignmentRows[0]?.id || "");
    });

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    return () => {
      stopCameraScanner();
    };
  }, []);

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const workItems = useMemo<WorkItem[]>(() => {
    return assignments.map((assignment) => {
      const task =
        tasks.find((row) => String(row.assignment_id || "") === String(assignment.id)) ||
        tasks.find((row) => String(row.operation_request_id || "") === String(assignment.operation_request_id || "")) ||
        null;

      const request = assignment.operation_request_id
        ? requestMap.get(String(assignment.operation_request_id)) || null
        : null;

      const treeId = assignment.tree_id || task?.tree_id || request?.tree_id || null;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;

      const groupId = assignment.group_id || task?.group_id || request?.group_id || tree?.group_id || null;
      const group = groupId ? groupMap.get(String(groupId)) || null : null;

      const customerId =
        assignment.customer_profile_id ||
        task?.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id ||
        null;

      const customer = customerId ? customerMap.get(String(customerId)) || null : null;
      const status = mergeStatuses(task?.status, assignment.status, request?.assignment_status, request?.status);
      const evidenceStatus = mergeStatuses(task?.evidence_status, task?.status, assignment.status, request?.assignment_status);
      const service = serviceOfRaw(
        task?.source_type,
        task?.task_type,
        assignment.source_type,
        assignment.assignment_type,
        request?.service_name,
        request?.operation_type,
        request?.request_type,
        request?.care_program_name,
      );

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
        service,
      };
    });
  }, [assignments, tasks, requestMap, treeMap, groupMap, customerMap]);

  const selected = useMemo(() => {
    return workItems.find((item) => item.key === selectedKey) || workItems[0] || null;
  }, [workItems, selectedKey]);

  useEffect(() => {
    if (!selectedKey && workItems[0]) setSelectedKey(workItems[0].key);
  }, [workItems, selectedKey]);

  const selectedEvidence = useMemo(() => {
    if (!selected) return { photos: [], gps: [], health: [] };

    return {
      photos: photoEvidence.filter((row) => String(row.assignment_id || "") === selected.key),
      gps: gpsEvidence.filter((row) => String(row.assignment_id || "") === selected.key),
      health: healthEvidence.filter((row) => String(row.assignment_id || "") === selected.key),
    };
  }, [selected, photoEvidence, gpsEvidence, healthEvidence]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return workItems;
    if (filter === "ACTIVE") return workItems.filter((item) => !CLOSED_STATUSES.includes(item.status));
    return workItems.filter((item) => item.status === filter);
  }, [workItems, filter]);

  const stats = useMemo(() => {
    return {
      assigned: workItems.filter((item) => item.status === "ASSIGNED").length,
      inProgress: workItems.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: workItems.filter((item) => item.status === "SUBMITTED").length,
      completed: workItems.filter((item) => item.status === "COMPLETED").length,
    };
  }, [workItems]);

  const isVerified = Boolean(selected && verifiedMap[selected.key]);
  const verifiedTree = selected ? verifiedMap[selected.key] || null : null;
  const needBeforeAfter = selected ? requiresBeforeAfter(selected.service) : false;

  function findTreeByScan(item: WorkItem, parsed: { treeId: string; treeCode: string }) {
    const scannedId = parsed.treeId.trim().toLowerCase();
    const scannedCode = parsed.treeCode.trim().toLowerCase();
    const assignedTreeId = String(item.tree?.id || item.assignment.tree_id || item.request?.tree_id || "").trim().toLowerCase();
    const assignedTreeCode = String(item.tree?.tree_code || item.assignment.tree_code || item.request?.tree_code || "").trim().toLowerCase();

    if (assignedTreeId || assignedTreeCode) {
      const matched =
        Boolean(scannedId && assignedTreeId && scannedId === assignedTreeId) ||
        Boolean(scannedCode && assignedTreeCode && scannedCode === assignedTreeCode);

      return matched
        ? {
            treeId: String(item.tree?.id || item.assignment.tree_id || item.request?.tree_id),
            treeCode: String(item.tree?.tree_code || item.assignment.tree_code || item.request?.tree_code || parsed.treeCode),
            treeName: treeDisplayName(item.tree),
            groupId: item.tree?.group_id || item.assignment.group_id || item.request?.group_id || null,
          }
        : null;
    }

    const groupId = String(item.assignment.group_id || item.task?.group_id || item.request?.group_id || item.group?.id || "");

    if (!groupId) return null;

    const matchedTree = trees.find((tree) => {
      const treeId = String(tree.id || "").toLowerCase();
      const treeCode = String(tree.tree_code || "").toLowerCase();
      const sameGroup = String(tree.group_id || "") === groupId;

      return sameGroup && ((scannedId && treeId === scannedId) || (scannedCode && treeCode === scannedCode));
    });

    if (!matchedTree) return null;

    return {
      treeId: String(matchedTree.id),
      treeCode: String(matchedTree.tree_code || parsed.treeCode || matchedTree.id),
      treeName: treeDisplayName(matchedTree),
      groupId: matchedTree.group_id || groupId,
    };
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

  async function saveQrAuditLog(item: WorkItem, parsed: { treeId: string; treeCode: string }, matchedTree: VerifiedTree) {
    if (!caretaker) return;

    try {
      await supabase.from("tree_verifications").insert({
        assignment_id: item.assignment.id,
        operation_request_id: item.assignment.operation_request_id || item.request?.id || null,
        tree_id: matchedTree.treeId,
        customer_profile_id:
          item.assignment.customer_profile_id ||
          item.task?.customer_profile_id ||
          item.request?.customer_profile_id ||
          item.request?.profile_id ||
          item.tree?.customer_profile_id ||
          item.tree?.profile_id ||
          null,
        caretaker_id: caretaker.id,
        verified_tree_code: parsed.treeCode || matchedTree.treeCode || matchedTree.treeId,
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
      setMessage("Scan or manually enter tree QR / tree code first.");
      return;
    }

    const parsed = parseScannedTreeValue(value);
    const matchedTree = findTreeByScan(selected, parsed);

    if (!matchedTree) {
      setVerifiedMap((current) => {
        const next = { ...current };
        delete next[selected.key];
        return next;
      });
      setMessage("Wrong Tree / Tree mismatch. Evidence upload blocked.");
      return;
    }

    setVerifiedMap((current) => ({
      ...current,
      [selected.key]: matchedTree,
    }));
    setMessage(`Tree Verified: ${matchedTree.treeName}. Evidence upload is now unlocked.`);
    await saveQrAuditLog(selected, parsed, matchedTree);
  }

  async function startCameraScanner() {
    if (!selected) return;

    setMessage("");

    try {
      setScannerOpen(true);
      setScannerRunning(true);
      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = `tasks-qr-scanner-${selected.key}`;
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
      setMessage(error?.message || "Unable to open camera scanner. Use manual fallback.");
    }
  }

  function resetEvidenceForm() {
    setCurrentPhoto(null);
    setBeforePhoto(null);
    setAfterPhoto(null);
    setLatitude("");
    setLongitude("");
    setHealthStatus("HEALTHY");
    setNotes("");
  }

  async function startWork() {
    if (!selected || !caretaker) return;
    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();

    try {
      if (selected.task?.id) {
        const { error } = await supabase
          .from("caretaker_task_logs")
          .update({
            status: "IN_PROGRESS",
            evidence_status: "PENDING",
            started_at: selected.task.started_at || now,
            updated_at: now,
          })
          .eq("id", selected.task.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("caretaker_task_logs").insert({
          assignment_id: selected.assignment.id,
          operation_request_id: selected.assignment.operation_request_id || selected.request?.id,
          tree_id: selected.assignment.tree_id || selected.request?.tree_id || null,
          group_id: selected.assignment.group_id || selected.request?.group_id || selected.group?.id || null,
          customer_profile_id:
            selected.assignment.customer_profile_id ||
            selected.request?.customer_profile_id ||
            selected.request?.profile_id ||
            selected.tree?.customer_profile_id ||
            selected.tree?.profile_id ||
            null,
          caretaker_id: caretaker.id,
          caretaker_profile_id: caretaker.caretaker_profile_id || null,
          task_type: selected.service,
          source_type: selected.service,
          status: "IN_PROGRESS",
          evidence_status: "PENDING",
          notes: "Gardener started field work.",
          started_at: now,
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

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

      setMessage("Work started. Verify tree QR before submitting evidence.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Failed to start work.");
    }

    setSaving(false);
  }

  async function uploadEvidenceFile(file: File | null, folder: string) {
    if (!file || !selected) return null;
    if (!caretaker) throw new Error("Caretaker profile not found.");
    if (!profile) throw new Error("Profile not found.");

    const ext = file.name.split(".").pop() || "jpg";
    const ownerProfileId = caretaker.caretaker_profile_id || profile.id || caretaker.id;

    if (!ownerProfileId) throw new Error("Storage owner profile id not found.");

    const path = `${ownerProfileId}/${folder}/${selected.assignment.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const upload = await supabase.storage.from("tree-evidence").upload(path, file, { upsert: true });

    if (upload.error) throw upload.error;

    return supabase.storage.from("tree-evidence").getPublicUrl(path).data.publicUrl;
  }

  function getSubmissionCore() {
    if (!selected || !caretaker || !verifiedTree) throw new Error("Work order or verified tree not loaded.");

    const operationRequestId = selected.assignment.operation_request_id || selected.request?.id;
    const customerProfileId =
      selected.assignment.customer_profile_id ||
      selected.task?.customer_profile_id ||
      selected.request?.customer_profile_id ||
      selected.request?.profile_id ||
      selected.tree?.customer_profile_id ||
      selected.tree?.profile_id ||
      null;
    const groupId = selected.assignment.group_id || selected.task?.group_id || selected.request?.group_id || verifiedTree.groupId || selected.group?.id || null;

    if (!selected.assignment.id) throw new Error("Missing assignment_id.");
    if (!operationRequestId) throw new Error("Missing operation_request_id.");
    if (!verifiedTree.treeId) throw new Error("Missing verified tree_id.");
    if (!customerProfileId) throw new Error("Missing customer_profile_id.");
    if (!caretaker.id) throw new Error("Missing caretaker_id.");

    return {
      assignmentId: selected.assignment.id,
      operationRequestId,
      treeId: verifiedTree.treeId,
      groupId,
      customerProfileId,
    };
  }

  async function getExistingEvidenceCounts(assignmentId: string): Promise<ExistingEvidenceCounts> {
    const [photoResult, gpsResult, healthResult] = await Promise.all([
      supabase.from("tree_photo_updates").select("id", { count: "exact" }).eq("assignment_id", assignmentId),
      supabase.from("tree_gps_logs").select("id", { count: "exact" }).eq("assignment_id", assignmentId),
      supabase.from("tree_health_reports").select("id", { count: "exact" }).eq("assignment_id", assignmentId),
    ]);

    if (photoResult.error) throw photoResult.error;
    if (gpsResult.error) throw gpsResult.error;
    if (healthResult.error) throw healthResult.error;

    return {
      photos: photoResult.count || 0,
      gps: gpsResult.count || 0,
      health: healthResult.count || 0,
      total: (photoResult.count || 0) + (gpsResult.count || 0) + (healthResult.count || 0),
    };
  }

  function validateSubmission(existing: ExistingEvidenceCounts) {
    if (!selected || !caretaker) return "Work order not loaded.";
    if (!isVerified) return "Tree QR must be verified before evidence upload.";
    if (SUBMIT_LOCK_STATUSES.includes(selected.status)) {
      return `This work order is already ${selected.status.replaceAll("_", " ")}. Duplicate submission is blocked.`;
    }
    if (selected.evidenceStatus === "SUBMITTED") return "Evidence is already submitted for this task.";
    if (existing.photos === 0 && !currentPhoto) return "Current photo is required.";
    if (existing.gps === 0 && (!latitude || !longitude)) return "GPS latitude and longitude are required.";
    if (existing.health === 0 && !healthStatus) return "Health status is required.";
    if (needBeforeAfter && !beforePhoto && existing.photos === 0) return "Before photo is required for this care service.";
    if (needBeforeAfter && !afterPhoto && existing.photos === 0) return "After photo is required for this care service.";

    if (latitude && Number.isNaN(Number(latitude))) return "Latitude must be a valid number.";
    if (longitude && Number.isNaN(Number(longitude))) return "Longitude must be a valid number.";

    return "";
  }

  async function rollbackInsertedEvidence(inserted: InsertedEvidenceIds) {
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
      console.error("Evidence rollback failed:", error);
    }
  }

  async function syncSubmissionStatuses(args: {
    now: string;
    operationRequestId: string;
    treeId: string;
    groupId: string | null;
    customerProfileId: string;
  }) {
    if (!selected || !caretaker) throw new Error("Work order not loaded.");

    const existingTaskId = selected.task?.id;
    let taskId = existingTaskId || null;

    if (!taskId) {
      const { data, error } = await supabase
        .from("caretaker_task_logs")
        .insert({
          assignment_id: selected.assignment.id,
          operation_request_id: args.operationRequestId,
          tree_id: args.treeId,
          group_id: args.groupId,
          customer_profile_id: args.customerProfileId,
          caretaker_id: caretaker.id,
          caretaker_profile_id: caretaker.caretaker_profile_id || null,
          task_type: selected.service,
          source_type: selected.service,
          status: "SUBMITTED",
          evidence_status: "SUBMITTED",
          notes: notes || "Evidence submitted.",
          submitted_at: args.now,
          created_at: args.now,
          updated_at: args.now,
        })
        .select("id")
        .single();

      if (error || !data?.id) throw new Error(`caretaker_task_logs insert failed: ${error?.message || "No task id returned."}`);
      taskId = data.id;
    }

    const { error: taskUpdateError } = await supabase
      .from("caretaker_task_logs")
      .update({
        tree_id: args.treeId,
        group_id: args.groupId,
        status: "SUBMITTED",
        evidence_status: "SUBMITTED",
        notes: notes || selected.task?.notes || "Evidence submitted.",
        submitted_at: args.now,
        updated_at: args.now,
      })
      .eq("id", taskId);

    if (taskUpdateError) throw new Error(`caretaker_task_logs sync failed: ${taskUpdateError.message}`);

    const assignmentUpdate: Row = {
      group_id: selected.assignment.group_id || args.groupId,
      status: "SUBMITTED",
      submitted_at: args.now,
      updated_at: args.now,
    };

    if (selected.assignment.tree_id || selected.request?.tree_id) {
      assignmentUpdate.tree_id = args.treeId;
    }

    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update(assignmentUpdate)
      .eq("id", selected.assignment.id);

    if (assignmentError) throw new Error(`caretaker_assignments sync failed: ${assignmentError.message}`);

    const requestUpdate: Row = {
      group_id: selected.request?.group_id || selected.assignment.group_id || args.groupId,
      status: "SUBMITTED",
      assignment_status: "SUBMITTED",
      updated_at: args.now,
    };

    if (selected.request?.tree_id || selected.assignment.tree_id) {
      requestUpdate.tree_id = args.treeId;
    }

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update(requestUpdate)
      .eq("id", args.operationRequestId);

    if (requestError) throw new Error(`tree_operation_requests sync failed: ${requestError.message}`);

    return taskId;
  }

  async function submitWork() {
    if (saving) return;

    if (!selected || !caretaker) {
      setMessage("Work order not loaded.");
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();
    const insertedEvidence: InsertedEvidenceIds = { photoIds: [], gpsIds: [], healthIds: [] };

    try {
      const core = getSubmissionCore();
      const existing = await getExistingEvidenceCounts(core.assignmentId);
      const validationError = validateSubmission(existing);

      if (validationError) throw new Error(validationError);

      const currentPhotoUrl = existing.photos === 0 ? await uploadEvidenceFile(currentPhoto, "current") : null;
      const beforePhotoUrl = existing.photos === 0 ? await uploadEvidenceFile(beforePhoto, "before") : null;
      const afterPhotoUrl = existing.photos === 0 ? await uploadEvidenceFile(afterPhoto, "after") : null;

      if (existing.photos === 0) {
        const { data, error } = await supabase
          .from("tree_photo_updates")
          .insert({
            assignment_id: core.assignmentId,
            operation_request_id: core.operationRequestId,
            tree_id: core.treeId,
            group_id: core.groupId,
            customer_profile_id: core.customerProfileId,
            caretaker_id: caretaker.id,
            caretaker_profile_id: caretaker.caretaker_profile_id || null,
            photo_url: currentPhotoUrl || beforePhotoUrl || afterPhotoUrl,
            image_url: currentPhotoUrl || beforePhotoUrl || afterPhotoUrl,
            before_photo_url: beforePhotoUrl,
            after_photo_url: afterPhotoUrl,
            caption: serviceLabel(selected.service),
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) throw new Error(`tree_photo_updates insert failed: ${error?.message || "No evidence id returned."}`);
        insertedEvidence.photoIds.push(data.id);
      }

      if (existing.gps === 0) {
        const mapUrl = `https://maps.google.com/?q=${Number(latitude)},${Number(longitude)}`;
        const { data, error } = await supabase
          .from("tree_gps_logs")
          .insert({
            assignment_id: core.assignmentId,
            operation_request_id: core.operationRequestId,
            tree_id: core.treeId,
            group_id: core.groupId,
            customer_profile_id: core.customerProfileId,
            caretaker_id: caretaker.id,
            caretaker_profile_id: caretaker.caretaker_profile_id || null,
            latitude: Number(latitude),
            longitude: Number(longitude),
            map_url: mapUrl,
            gps_url: mapUrl,
            location_note: notes || null,
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) throw new Error(`tree_gps_logs insert failed: ${error?.message || "No evidence id returned."}`);
        insertedEvidence.gpsIds.push(data.id);
      }

      if (existing.health === 0) {
        const issueSeverity = healthStatus === "CRITICAL" ? "CRITICAL" : healthStatus === "NEEDS_ATTENTION" ? "ATTENTION" : null;
        const { data, error } = await supabase
          .from("tree_health_reports")
          .insert({
            assignment_id: core.assignmentId,
            operation_request_id: core.operationRequestId,
            tree_id: core.treeId,
            group_id: core.groupId,
            customer_profile_id: core.customerProfileId,
            caretaker_id: caretaker.id,
            caretaker_profile_id: caretaker.caretaker_profile_id || null,
            health_status: healthStatus,
            issue_severity: issueSeverity,
            issue_summary: notes || null,
            report_notes: notes || null,
            notes: notes || null,
            status: "SUBMITTED",
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (error || !data?.id) throw new Error(`tree_health_reports insert failed: ${error?.message || "No evidence id returned."}`);
        insertedEvidence.healthIds.push(data.id);
      }

      await syncSubmissionStatuses({
        now,
        operationRequestId: core.operationRequestId,
        treeId: core.treeId,
        groupId: core.groupId,
        customerProfileId: core.customerProfileId,
      });

      setMessage("Task Submitted Successfully. Waiting for Admin Review.");
      resetEvidenceForm();
      setVerifiedMap((current) => {
        const next = { ...current };
        delete next[selected.key];
        return next;
      });
      setScanValue("");
      setFilter("SUBMITTED");
      await loadData();
    } catch (error: any) {
      await rollbackInsertedEvidence(insertedEvidence);
      setMessage(`${error?.message || "Submit work failed."} Evidence from this failed attempt was rolled back.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">Gardener Field Workflow</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Forest Work Center</h1>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-relaxed text-white/65">
            Start work, verify the physical tree QR, upload Photo + GPS + Health evidence, then submit to Admin Review.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <Card title="1. Work Queue">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Assigned" value={stats.assigned} />
                <MiniStat label="In Progress" value={stats.inProgress} />
                <MiniStat label="Submitted" value={stats.submitted} />
                <MiniStat label="Completed" value={stats.completed} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {["ACTIVE", "ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-full px-4 py-2 text-xs font-black ${
                      filter === item ? "bg-[#d9b45f] text-[#071f16]" : "border border-white/10 bg-white/10 text-white/65"
                    }`}
                  >
                    {item.replaceAll("_", " ")}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm font-bold text-white/50">Loading work queue...</p>
                ) : visibleItems.length === 0 ? (
                  <p className="text-sm font-bold text-white/50">No work orders found.</p>
                ) : (
                  visibleItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSelectedKey(item.key);
                        stopCameraScanner();
                        setScanValue("");
                        resetEvidenceForm();
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected?.key === item.key
                          ? "border-[#d9b45f]/60 bg-[#d9b45f]/15"
                          : "border-white/10 bg-black/20 hover:bg-white/10"
                      }`}
                    >
                      <p className="text-sm font-black text-[#ffe49a]">{serviceLabel(item.service)}</p>
                      <p className="mt-1 text-xs font-semibold text-white/55">
                        {treeDisplayName(item.tree) || groupDisplayName(item.group, item.tree)}
                      </p>
                      <p className="mt-2 text-xs font-black text-white/40">{item.status.replaceAll("_", " ")}</p>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="2. Work Order">
              {!selected ? (
                <p className="text-sm font-bold text-white/55">Select a work order.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Tree / Forest" value={verifiedTree?.treeName || treeDisplayName(selected.tree)} />
                  <Info label="Tree Code" value={verifiedTree?.treeCode || selected.tree?.tree_code || selected.tree?.id || "Scan required"} />
                  <Info label="Forest / Group" value={groupDisplayName(selected.group, selected.tree)} />
                  <Info label="Customer" value={customerDisplayName(selected.customer)} />
                  <Info label="Requested Service" value={serviceLabel(selected.service)} />
                  <Info label="Admin Notes" value={selected.assignment.admin_notes || selected.request?.admin_notes || selected.request?.notes || "—"} />
                  <Info label="Assignment Status" value={selected.status.replaceAll("_", " ")} />
                  <Info label="Evidence Status" value={selected.evidenceStatus.replaceAll("_", " ")} />
                  <Info label="Photo Evidence" value={`${selectedEvidence.photos.length} row(s)`} />
                  <Info label="GPS Evidence" value={`${selectedEvidence.gps.length} row(s)`} />
                  <Info label="Health Evidence" value={`${selectedEvidence.health.length} row(s)`} />
                  <Info label="Last Submission" value={formatDate(selected.task?.submitted_at || selected.request?.updated_at)} />
                </div>
              )}

              {selected && selected.status === "ASSIGNED" && (
                <button
                  onClick={startWork}
                  disabled={saving}
                  className="mt-5 w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774] disabled:opacity-50"
                >
                  Start Work
                </button>
              )}
            </Card>

            <Card title="3. Scan Tree QR">
              <p className="text-sm font-semibold text-white/60">
                Supports tree_code, tree_id, /tree/verify/tree_id, and full https://domain/tree/verify/tree_id QR values.
              </p>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <button
                  onClick={scannerOpen ? stopCameraScanner : startCameraScanner}
                  disabled={!selected || (scannerRunning && !scannerOpen)}
                  className="rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-[#03130d] disabled:opacity-50"
                >
                  {scannerOpen ? "Close Camera Scanner" : "Open Camera Scanner"}
                </button>
                <input
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  placeholder="Manual Tree QR / Tree Code Fallback"
                  className="min-h-[50px] flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-white/30"
                />
                <button onClick={() => verifyTree()} className="rounded-2xl bg-[#d9b45f] px-6 py-4 text-sm font-black text-[#071f16]">
                  Verify Tree
                </button>
              </div>

              {scannerOpen && selected && (
                <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-black/30 p-4">
                  <div id={`tasks-qr-scanner-${selected.key}`} className="min-h-[280px] overflow-hidden rounded-xl" />
                  <p className="mt-3 text-xs font-bold text-white/50">Point the camera at the physical tree QR sticker.</p>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-black">
                {isVerified ? (
                  <span className="text-emerald-300">Tree Verified: {verifiedTree?.treeName}</span>
                ) : (
                  <span className="text-red-200">Not verified — evidence blocked</span>
                )}
              </div>
            </Card>

            <Card title="4. Evidence Center">
              <p className="text-sm font-bold text-[#ffe49a]">Required before Submit Work: Photo + GPS + Health Report.</p>

              {needBeforeAfter && (
                <p className="mt-2 rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-3 text-xs font-bold text-[#ffe49a]">
                  This care service also requires before and after photos.
                </p>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <FileInput label="Current Photo Required" file={currentPhoto} setFile={setCurrentPhoto} />
                {needBeforeAfter && <FileInput label="Before Photo Required" file={beforePhoto} setFile={setBeforePhoto} />}
                {needBeforeAfter && <FileInput label="After Photo Required" file={afterPhoto} setFile={setAfterPhoto} />}
                <TextInput label="Latitude Required" value={latitude} setValue={setLatitude} />
                <TextInput label="Longitude Required" value={longitude} setValue={setLongitude} />
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">Health Status Required</p>
                  <select
                    value={healthStatus}
                    onChange={(event) => setHealthStatus(event.target.value)}
                    className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none"
                  >
                    <option value="HEALTHY">Healthy</option>
                    <option value="NEEDS_ATTENTION">Needs Attention</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">Field Notes Optional</p>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-white outline-none placeholder:text-white/30"
                    placeholder="Field notes / observations"
                  />
                </div>
              </div>
            </Card>

            <Card title="5. Submit Work">
              <p className="text-sm font-semibold leading-relaxed text-white/60">
                Submit changes task, assignment, and operation request to SUBMITTED only. Admin must approve before customer sees COMPLETED.
              </p>

              <button
                onClick={submitWork}
                disabled={saving || !selected || !isVerified}
                className="mt-5 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-[#03130d] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Submitting Work..." : "Submit Work for Admin Review"}
              </button>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <h2 className="mb-5 text-xl font-black text-[#ffe49a]">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-white/80">{value || "—"}</p>
    </div>
  );
}

function FileInput({ label, file, setFile }: { label: string; file: File | null; setFile: (file: File | null) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/40">{label}</span>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-white"
      />
      {file && <span className="mt-2 block text-xs font-bold text-emerald-200">Selected: {file.name}</span>}
    </label>
  );
}

function TextInput({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/40">{label}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none"
      />
    </label>
  );
}
