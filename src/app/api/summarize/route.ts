import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { getSubmissions } from "@/lib/submissions-query";
import { submissionsToCsv } from "@/lib/csv";
import {
  SYSTEM_PROMPT,
  pipelinePrompt,
  repPrompt,
} from "@/lib/summarize-prompts";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-5";
const MAX_INPUT_TOKENS = 60_000;
const MAX_OUTPUT_TOKENS = 2_000;

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
  } | null;
  const scope = body?.scope;
  if (scope !== "pipeline" && scope !== "rep") {
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

  const rows = await getSubmissions(scope === "rep" ? repId : undefined);

  let repName = repId;
  if (scope === "rep") {
    const u = (
      await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.repId, repId))
    )[0];
    repName = u?.name || repId;
    if (rows.length === 0) {
      // GATE 1: skip the model entirely — nothing to summarize.
      return textStream(
        `No submissions for ${repName} yet — nothing to summarize.`,
      );
    }
  }

  const csv = submissionsToCsv(rows);
  const repCount = new Set(rows.map((r) => r.repId)).size;
  const userPrompt =
    scope === "rep"
      ? repPrompt(csv, rows.length, repId, repName)
      : pipelinePrompt(csv, rows.length, repCount);

  const anthropic = new Anthropic();

  // Token-cap preflight (also doubles as an auth/connectivity check).
  try {
    const counted = await anthropic.messages.countTokens({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    if (counted.input_tokens > MAX_INPUT_TOKENS) {
      return NextResponse.json(
        {
          error:
            "Too much data to summarize at once — filter to a specific rep or date range.",
        },
        { status: 400 },
      );
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
    // countTokens unavailable for some other reason — fall back to a
    // conservative char/4 estimate so the feature never hard-fails.
    const est = Math.ceil(
      (SYSTEM_PROMPT.length + userPrompt.length) / 4,
    );
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
      messages: [{ role: "user", content: userPrompt }],
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
            submissions: rows.length,
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
