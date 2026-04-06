import type { SupabaseClient } from "@supabase/supabase-js";

type QueueTransition = "entered" | "left" | "unchanged";

type QueueStatusPatch = Record<string, unknown>;

export type QueueAwareStatusUpdateInput = {
  supabase: SupabaseClient;
  bookingId: string;
  previousStatus: string | null;
  nextStatus: string | null;
  queueTriggerStatus?: string | null;
  patch?: QueueStatusPatch;
};

export type QueueAwareStatusUpdateResult =
  | {
      ok: true;
      transition: QueueTransition;
      queuePosition?: number | null;
    }
  | {
      ok: false;
      errorMessage: string;
    };

function normalizeStatus(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return trimmed || null;
}

function resolveErrorMessage(error: { message?: string } | null, fallback: string) {
  const message = error?.message?.trim();
  return message || fallback;
}

export async function updateBookingStatusWithQueueTransition(
  input: QueueAwareStatusUpdateInput,
): Promise<QueueAwareStatusUpdateResult> {
  const trigger = normalizeStatus(input.queueTriggerStatus);
  const previousStatus = normalizeStatus(input.previousStatus);
  const nextStatus = normalizeStatus(input.nextStatus);
  const wasQueue = Boolean(trigger) && previousStatus === trigger;
  const isQueue = Boolean(trigger) && nextStatus === trigger;
  const basePatch: QueueStatusPatch = {
    status: nextStatus,
    client_status: nextStatus,
    ...(input.patch || {}),
  };

  if (isQueue && !wasQueue) {
    const { data: queueRows, error: queueRowsError } = await input.supabase
      .from("bookings")
      .select("queue_position")
      .eq("client_status", trigger as string)
      .not("queue_position", "is", null);
    if (queueRowsError) {
      return {
        ok: false,
        errorMessage: resolveErrorMessage(
          queueRowsError,
          "Failed to read queue data.",
        ),
      };
    }

    const maxPosition = (Array.isArray(queueRows) ? queueRows : []).reduce(
      (max, row) => {
        const value =
          typeof row?.queue_position === "number" && Number.isFinite(row.queue_position)
            ? row.queue_position
            : 0;
        return Math.max(max, value);
      },
      0,
    );
    const nextQueuePosition = maxPosition + 1;

    const { error: updateError } = await input.supabase
      .from("bookings")
      .update({
        ...basePatch,
        queue_position: nextQueuePosition,
      })
      .eq("id", input.bookingId);
    if (updateError) {
      return {
        ok: false,
        errorMessage: resolveErrorMessage(
          updateError,
          "Failed to update booking status.",
        ),
      };
    }

    return {
      ok: true,
      transition: "entered",
      queuePosition: nextQueuePosition,
    };
  }

  if (wasQueue && !isQueue) {
    const { error: updateError } = await input.supabase
      .from("bookings")
      .update({
        ...basePatch,
        queue_position: null,
      })
      .eq("id", input.bookingId);
    if (updateError) {
      return {
        ok: false,
        errorMessage: resolveErrorMessage(
          updateError,
          "Failed to update booking status.",
        ),
      };
    }

    const { data: remainingRows, error: remainingRowsError } = await input.supabase
      .from("bookings")
      .select("id, queue_position")
      .eq("client_status", trigger as string)
      .neq("id", input.bookingId)
      .not("queue_position", "is", null)
      .order("queue_position", { ascending: true });
    if (remainingRowsError) {
      return {
        ok: false,
        errorMessage: resolveErrorMessage(
          remainingRowsError,
          "Failed to read remaining queue data.",
        ),
      };
    }

    const normalizedRows = Array.isArray(remainingRows) ? remainingRows : [];
    for (let index = 0; index < normalizedRows.length; index += 1) {
      const queueRow = normalizedRows[index];
      if (!queueRow?.id || typeof queueRow.id !== "string") continue;

      const { error: reindexError } = await input.supabase
        .from("bookings")
        .update({ queue_position: index + 1 })
        .eq("id", queueRow.id);
      if (reindexError) {
        return {
          ok: false,
          errorMessage: resolveErrorMessage(
            reindexError,
            "Failed to reindex queue data.",
          ),
        };
      }
    }

    return {
      ok: true,
      transition: "left",
      queuePosition: null,
    };
  }

  const { error: updateError } = await input.supabase
    .from("bookings")
    .update(basePatch)
    .eq("id", input.bookingId);
  if (updateError) {
    return {
      ok: false,
      errorMessage: resolveErrorMessage(
        updateError,
        "Failed to update booking status.",
      ),
    };
  }

  return {
    ok: true,
    transition: "unchanged",
  };
}
