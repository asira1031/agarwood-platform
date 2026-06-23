async function approveValuation(item: ValuationItem) {
  setMessage("");

  const amount = Number(valuationAmount[item.request.id] || 0);

  if (!item.tree?.id && !item.request.tree_id) {
    setMessage("This valuation request has no linked tree.");
    return;
  }

  if (item.status !== "SUBMITTED" && item.status !== "COMPLETED") {
    setMessage("Gardener evidence must be submitted before valuation approval.");
    return;
  }

  if (!amount || amount <= 0) {
    setMessage("Enter official valuation amount.");
    return;
  }

  const confirmed = window.confirm(`Approve official tree value of ${peso(amount)}?`);
  if (!confirmed) return;

  const now = new Date().toISOString();
  const treeId = item.tree?.id || item.request.tree_id;

  setProcessingId(item.request.id);

  const { error: requestError } = await supabase
    .from("tree_operation_requests")
    .update({
      status: "COMPLETED",
      assignment_status: "COMPLETED",
      admin_notes:
        adminNotes[item.request.id] ||
        `Official tree valuation approved at ${peso(amount)}.`,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", item.request.id);

  if (requestError) {
    setMessage(requestError.message);
    setProcessingId("");
    return;
  }

  if (item.assignment?.id) {
    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update({
        status: "COMPLETED",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.assignment.id);

    if (assignmentError) {
      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Assignment sync failed. Request rollback applied: ${assignmentError.message}`);
      setProcessingId("");
      return;
    }
  }

  if (item.task?.id) {
    const { error: taskError } = await supabase
      .from("caretaker_task_logs")
      .update({
        status: "COMPLETED",
        evidence_status: "APPROVED",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.task.id);

    if (taskError) {
      if (item.assignment?.id) {
        await supabase
          .from("caretaker_assignments")
          .update({
            status: item.assignment.status || "SUBMITTED",
            completed_at: item.assignment.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.assignment.id);
      }

      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Task sync failed. Rollback applied: ${taskError.message}`);
      setProcessingId("");
      return;
    }
  }

  const { error: treeError } = await supabase
    .from("trees")
    .update({
      valuation_status: "APPROVED",
      valuation_amount: amount,
      updated_at: now,
    })
    .eq("id", treeId);

  if (treeError) {
    if (item.task?.id) {
      await supabase
        .from("caretaker_task_logs")
        .update({
          status: item.task.status || "SUBMITTED",
          evidence_status: item.task.evidence_status || "SUBMITTED",
          completed_at: item.task.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.task.id);
    }

    if (item.assignment?.id) {
      await supabase
        .from("caretaker_assignments")
        .update({
          status: item.assignment.status || "SUBMITTED",
          completed_at: item.assignment.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.assignment.id);
    }

    await supabase
      .from("tree_operation_requests")
      .update({
        status: item.request.status || "SUBMITTED",
        assignment_status: item.request.assignment_status || "SUBMITTED",
        completed_at: item.request.completed_at || null,
        updated_at: now,
      })
      .eq("id", item.request.id);

    setMessage(`Tree valuation sync failed. Rollback applied: ${treeError.message}`);
    setProcessingId("");
    return;
  }

  setMessage("Official valuation approved and fully synced.");
  setProcessingId("");
  await loadData();
  setTab("COMPLETED");
}

async function rejectValuation(item: ValuationItem) {
  const notes = adminNotes[item.request.id] || "";

  if (!notes.trim()) {
    setMessage("Admin notes are required before rejecting.");
    return;
  }

  const confirmed = window.confirm("Reject this valuation request?");
  if (!confirmed) return;

  const now = new Date().toISOString();
  const treeId = item.tree?.id || item.request.tree_id || null;

  setProcessingId(item.request.id);

  const { error: requestError } = await supabase
    .from("tree_operation_requests")
    .update({
      status: "REJECTED",
      assignment_status: "REJECTED",
      admin_notes: notes,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", item.request.id);

  if (requestError) {
    setMessage(requestError.message);
    setProcessingId("");
    return;
  }

  if (item.assignment?.id) {
    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update({
        status: "REJECTED",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.assignment.id);

    if (assignmentError) {
      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Assignment rejection sync failed. Request rollback applied: ${assignmentError.message}`);
      setProcessingId("");
      return;
    }
  }

  if (item.task?.id) {
    const { error: taskError } = await supabase
      .from("caretaker_task_logs")
      .update({
        status: "REJECTED",
        evidence_status: "REJECTED",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.task.id);

    if (taskError) {
      if (item.assignment?.id) {
        await supabase
          .from("caretaker_assignments")
          .update({
            status: item.assignment.status || "SUBMITTED",
            completed_at: item.assignment.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.assignment.id);
      }

      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Task rejection sync failed. Rollback applied: ${taskError.message}`);
      setProcessingId("");
      return;
    }
  }

  if (treeId) {
    const { error: treeError } = await supabase
      .from("trees")
      .update({
        valuation_status: "REJECTED",
        updated_at: now,
      })
      .eq("id", treeId);

    if (treeError) {
      if (item.task?.id) {
        await supabase
          .from("caretaker_task_logs")
          .update({
            status: item.task.status || "SUBMITTED",
            evidence_status: item.task.evidence_status || "SUBMITTED",
            completed_at: item.task.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.task.id);
      }

      if (item.assignment?.id) {
        await supabase
          .from("caretaker_assignments")
          .update({
            status: item.assignment.status || "SUBMITTED",
            completed_at: item.assignment.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.assignment.id);
      }

      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Tree rejection sync failed. Rollback applied: ${treeError.message}`);
      setProcessingId("");
      return;
    }
  }

  setMessage("Valuation request rejected and fully synced.");
  setProcessingId("");
  await loadData();
}