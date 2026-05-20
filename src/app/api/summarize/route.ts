import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { get } from "@vercel/blob";
import { db } from "@/lib/db/client";
import {
  photos,
  submissions,
  users,
  type PhotoRow,
  type SubmissionRow,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { getSubmissions } from "@/lib/submissions-query";
import { submissionsToCsv } from "@/lib/csv";
import {
  SYSTEM_PROMPT,
  pipelinePromptParts,
  repPromptParts,
  visitPromptParts,
  type PhotoForPrompt,
} from "@/lib/summarize-prompts";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-5";
const MAX_INPUT_TOKENS = 60_000;
const MAX_OUTPUT_TOKENS = 2_000;
// Cycle 13: hard ceiling on photos sent to Claude per request. Matches
// the per-submission UI cap (MAX_PHOTOS_PER_SUBMISSION); for pipeline/
// rep scope it's an upper bound on the total grid we'll send.
const MAX_PHOTOS_IN_PROMPT = 20;

function textStream(text: string) {
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
        c.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

type Scope = "pipeline" | "rep" | "visit";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("/api/summarize: ANTHROPIC_API_KEY not set");
    return NextResponse.json(
      { error: "Couldn't generate the summary — server is misconfigured." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    scope?: unknown;
    repId?: unknown;
    submissionId?: unknown;
  } | null;
  const scope = body?.scope as Scope | undefined;
  if (scope !== "pipeline" && scope !== "rep" && scope !== "visit") {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }
  const repId =
    typeof body?.repId === "string" ? body.repId.trim() : "";
  if (scope === "rep" && !repId) {
    return NextResponse.json(
      { error: "Choose a rep first." },
      { status: 400 },
    );
  }
  const submissionId =
    typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  if (scope === "visit" && !submissionId) {
    return NextResponse.json(
      { error: "Missing submissionId." },
      { status: 400 },
    );
  }

  // --- load rows ----------------------------------------------------
  let rows: SubmissionRow[] = [];
  let visitRow: SubmissionRow | undefined;
  let repName = repId;

  if (scope === "visit") {
    visitRow = (
      await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submissionId))
    )[0];
    if (!visitRow) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 },
      );
    }
    rows = [visitRow];
  } else {
    rows = await getSubmissions(scope === "rep" ? repId : undefined);
    if (scope === "rep") {
      const u = (
        await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.repId, repId))
      )[0];
      repName = u?.name || repId;
      if (rows.length === 0) {
        return textStream(
          `No submissions for ${repName} yet — nothing to summarize.`,
        );
      }
    }
  }

  // --- load + fetch photos ------------------------------------------
  // For each submission in scope, pull its non-deleted photo rows.
  // For pipeline/rep we cap at MAX_PHOTOS_IN_PROMPT (newest first,
  // grouped by school via insertion order). For visit we cap the
  // same (matches the UI cap; deeper grids blow the token budget).
  let promptPhotos: PhotoForPrompt[] = [];
  let photosDropped = 0;
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const photoRows = await db
      .select()
      .from(photos)
      .where(and(inArray(photos.submissionId, ids), isNull(photos.deletedAt)))
      .orderBy(photos.uploadedAt);

    // Newest first; pipeline summaries see fresh evidence first.
    const ordered = [...photoRows].reverse();
    const capped = ordered.slice(0, MAX_PHOTOS_IN_PROMPT);
    photosDropped = ordered.length - capped.length;
    promptPhotos = await Promise.all(capped.map(fetchPhotoBytes));
  }

  // --- build messages ----------------------------------------------
  const csv = submissionsToCsv(rows);
  const repCount = new Set(rows.map((r) => r.repId)).size;
  let userContent =
    scope === "rep"
      ? repPromptParts(csv, rows.length, repId, repName, rows, promptPhotos)
      : scope === "visit"
        ? visitPromptParts(visitRow!, csv, promptPhotos)
        : pipelinePromptParts(csv, rows.length, repCount, rows, promptPhotos);

  const anthropic = new Anthropic();

  // --- token-cap preflight + photo-drop fallback -------------------
  // If the structured request is over cap, retry with fewer photos
  // (drop oldest first). If still over with zero photos, return the
  // canonical 400 message — same as Cycle 8.
  try {
    let attempt = 0;
    let workingPhotos = [...promptPhotos];
    while (true) {
      const counted = await anthropic.messages.countTokens({
        model: MODEL,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });
      if (counted.input_tokens <= MAX_INPUT_TOKENS) break;
      attempt += 1;
      if (workingPhotos.length === 0) {
        // Text-only and still over cap — give up.
        return NextResponse.json(
          {
            error:
              "Too much data to summarize at once — filter to a specific rep or date range.",
          },
          { status: 400 },
        );
      }
      // Drop oldest photo (end of `workingPhotos` since `promptPhotos`
      // came back newest-first); rebuild the message.
      workingPhotos.pop();
      photosDropped += 1;
      userContent =
        scope === "rep"
          ? repPromptParts(csv, rows.length, repId, repName, rows, workingPhotos)
          : scope === "visit"
            ? visitPromptParts(visitRow!, csv, workingPhotos)
            : pipelinePromptParts(
                csv,
                rows.length,
                repCount,
                rows,
                workingPhotos,
              );
      if (attempt > MAX_PHOTOS_IN_PROMPT + 1) break; // safety
    }
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status && [401, 403, 429, 500, 529].includes(status)) {
      console.error("/api/summarize preflight API error status:", status);
      return NextResponse.json(
        { error: "Couldn't generate the summary — try again in a moment." },
        { status: 502 },
      );
    }
    // countTokens unavailable for some other reason — conservative
    // char/4 estimate over the text portion (image tokens unknown
    // here; we accept the risk for the fallback path).
    const textPart = userContent.find((c) => c.type === "text");
    const textLen = textPart && textPart.type === "text" ? textPart.text.length : 0;
    const est = Math.ceil((SYSTEM_PROMPT.length + textLen) / 4);
    if (est > MAX_INPUT_TOKENS) {
      return NextResponse.json(
        {
          error:
            "Too much data to summarize at once — filter to a specific rep or date range.",
        },
        { status: 400 },
      );
    }
  }

  const t0 = Date.now();
  const ms = anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    },
    { signal: req.signal },
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        ms.on("text", (t) => {
          try {
            controller.enqueue(encoder.encode(t));
          } catch {
            /* controller closed (client gone) */
          }
        });
        const final = await ms.finalMessage();
        // Metadata + token usage ONLY — never submission content/prompt.
        console.log(
          "[summarize]",
          JSON.stringify({
            scope,
            repId: scope === "rep" ? repId : null,
            submissionId: scope === "visit" ? submissionId : null,
            submissions: rows.length,
            photos: countImageBlocks(userContent),
            photosDropped,
            ms: Date.now() - t0,
            inputTokens: final.usage?.input_tokens ?? null,
            outputTokens: final.usage?.output_tokens ?? null,
          }),
        );
        controller.close();
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") {
          try {
            controller.close();
          } catch {
            /* noop */
          }
          return;
        }
        console.error(
          "[summarize] mid-stream error:",
          (err as { message?: string })?.message,
        );
        try {
          controller.enqueue(
            encoder.encode(
              "\n\n[Summary interrupted — please regenerate.]",
            ),
          );
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
    cancel() {
      try {
        ms.abort();
      } catch {
        /* noop */
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function countImageBlocks(
  content: Array<{ type: string }>,
): number {
  return content.filter((c) => c.type === "image").length;
}

async function fetchPhotoBytes(row: PhotoRow): Promise<PhotoForPrompt> {
  const result = await get(row.blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`blob fetch failed for ${row.id}`);
  }
  const bytes = new Uint8Array(
    await new Response(result.stream).arrayBuffer(),
  );
  const data = bufferToBase64(bytes);
  const mediaType = normalizeMediaType(row.mimeType);
  return {
    id: row.id,
    submissionId: row.submissionId,
    caption: row.caption,
    data,
    mediaType,
  };
}

// Node 22 has Buffer; using it directly is the simplest path.
function bufferToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function normalizeMediaType(
  mt: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (
    mt === "image/jpeg" ||
    mt === "image/png" ||
    mt === "image/webp" ||
    mt === "image/gif"
  ) {
    return mt;
  }
  // Default to JPEG — our compression pipeline emits JPEG.
  return "image/jpeg";
}
