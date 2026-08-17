import { createClient } from "@/lib/supabase/client";
import type {
  ProWorkflow,
  ProWorkflowBundle,
  ProWorkflowCard,
  ProWorkflowSeed,
  ProWorkflowStage,
} from "@/lib/pro-workflows/types";

type WorkflowRow = {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  starter_key: string | null;
  sort: number;
};

type StageRow = {
  id: string;
  workflow_id: string;
  name: string;
  description: string | null;
  sort: number;
};

type CardRow = {
  id: string;
  workflow_id: string;
  stage_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  sort: number;
  is_example: boolean;
  created_at: string;
  updated_at: string;
};

function migrationError(error: { message?: string }): Error {
  if (/pro_workflow|schema cache|does not exist/i.test(error.message ?? "")) {
    return new Error("Pro workflow boards need migration 109 before they can open.");
  }
  return new Error(error.message || "Couldn't load the workflow board.");
}

function toStage(row: StageRow): ProWorkflowStage {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    name: row.name,
    description: row.description,
    sort: row.sort,
  };
}

function toCard(row: CardRow): ProWorkflowCard {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    stageId: row.stage_id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    sort: row.sort,
    isExample: row.is_example,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchProWorkflowBundle(
  spaceId: string
): Promise<ProWorkflowBundle> {
  const supabase = createClient();
  const [preferenceResult, workflowResult] = await Promise.all([
    supabase
      .from("pro_workflow_preferences")
      .select("space_id")
      .eq("space_id", spaceId)
      .maybeSingle(),
    supabase
      .from("pro_workflows")
      .select("id, space_id, name, description, starter_key, sort")
      .eq("space_id", spaceId)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (preferenceResult.error) throw migrationError(preferenceResult.error);
  if (workflowResult.error) throw migrationError(workflowResult.error);

  const rows = (workflowResult.data ?? []) as WorkflowRow[];
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return { initialized: Boolean(preferenceResult.data), workflows: [] };
  }

  const [stageResult, cardResult] = await Promise.all([
    supabase
      .from("pro_workflow_stages")
      .select("id, workflow_id, name, description, sort")
      .in("workflow_id", ids)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("pro_workflow_cards")
      .select("id, workflow_id, stage_id, title, notes, due_date, sort, is_example, created_at, updated_at")
      .in("workflow_id", ids)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (stageResult.error) throw migrationError(stageResult.error);
  if (cardResult.error) throw migrationError(cardResult.error);

  const stages = (stageResult.data ?? []) as StageRow[];
  const cards = (cardResult.data ?? []) as CardRow[];
  const workflows: ProWorkflow[] = rows.map((row) => ({
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    description: row.description,
    starterKey: row.starter_key,
    sort: row.sort,
    stages: stages.filter((stage) => stage.workflow_id === row.id).map(toStage),
    cards: cards.filter((card) => card.workflow_id === row.id).map(toCard),
  }));
  return { initialized: Boolean(preferenceResult.data), workflows };
}

export async function installProWorkflowSeeds(
  spaceId: string,
  seeds: ProWorkflowSeed[]
): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in again, then retry.");

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const { data: existing, error: existingError } = await supabase
      .from("pro_workflows")
      .select("id")
      .eq("space_id", spaceId)
      .eq("starter_key", seed.key)
      .maybeSingle();
    if (existingError) throw migrationError(existingError);
    if (existing) continue;

    const { data: workflow, error: workflowError } = await supabase
      .from("pro_workflows")
      .insert({
        space_id: spaceId,
        name: seed.name,
        description: seed.description,
        starter_key: seed.key,
        sort: index * 100,
      })
      .select("id")
      .single();
    if (workflowError) {
      if (workflowError.code === "23505") continue;
      throw migrationError(workflowError);
    }

    const { data: stageRows, error: stageError } = await supabase
      .from("pro_workflow_stages")
      .insert(
        seed.stages.map((stage, stageIndex) => ({
          workflow_id: workflow.id,
          name: stage.name,
          description: stage.description,
          sort: stageIndex * 100,
        }))
      )
      .select("id, sort");
    if (stageError) throw migrationError(stageError);
    const firstStage = [...(stageRows ?? [])].sort((a, b) => a.sort - b.sort)[0];
    if (firstStage) {
      const { error: cardError } = await supabase.from("pro_workflow_cards").insert({
        workflow_id: workflow.id,
        stage_id: firstStage.id,
        title: seed.example.title,
        notes: seed.example.notes,
        is_example: true,
      });
      if (cardError) throw migrationError(cardError);
    }
  }

  const { error: preferenceError } = await supabase
    .from("pro_workflow_preferences")
    .upsert({ user_id: auth.user.id, space_id: spaceId }, { onConflict: "user_id,space_id" });
  if (preferenceError) throw migrationError(preferenceError);
}

export async function createProWorkflow(
  spaceId: string,
  input: { name: string; description?: string | null }
): Promise<void> {
  const supabase = createClient();
  const { data: workflow, error } = await supabase
    .from("pro_workflows")
    .insert({ space_id: spaceId, name: input.name.trim(), description: input.description?.trim() || null })
    .select("id")
    .single();
  if (error) throw migrationError(error);
  const { error: stageError } = await supabase.from("pro_workflow_stages").insert(
    ["Ideas", "Moving", "Waiting", "Complete"].map((name, index) => ({
      workflow_id: workflow.id,
      name,
      sort: index * 100,
    }))
  );
  if (stageError) throw migrationError(stageError);
}

export async function updateProWorkflow(
  id: string,
  patch: { name?: string; description?: string | null }
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  const { error } = await createClient().from("pro_workflows").update(values).eq("id", id);
  if (error) throw migrationError(error);
}

export async function deleteProWorkflow(id: string): Promise<void> {
  const { error } = await createClient().from("pro_workflows").delete().eq("id", id);
  if (error) throw migrationError(error);
}

export async function createProWorkflowStage(
  workflowId: string,
  input: { name: string; description?: string | null; sort: number }
): Promise<void> {
  const { error } = await createClient().from("pro_workflow_stages").insert({
    workflow_id: workflowId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sort: input.sort,
  });
  if (error) throw migrationError(error);
}

export async function updateProWorkflowStage(
  id: string,
  patch: { name?: string; description?: string | null; sort?: number }
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.sort !== undefined) values.sort = patch.sort;
  const { error } = await createClient().from("pro_workflow_stages").update(values).eq("id", id);
  if (error) throw migrationError(error);
}

export async function deleteProWorkflowStage(
  stageId: string,
  moveCardsToStageId: string
): Promise<void> {
  const supabase = createClient();
  const { error: moveError } = await supabase
    .from("pro_workflow_cards")
    .update({ stage_id: moveCardsToStageId })
    .eq("stage_id", stageId);
  if (moveError) throw migrationError(moveError);
  const { error } = await supabase.from("pro_workflow_stages").delete().eq("id", stageId);
  if (error) throw migrationError(error);
}

export async function createProWorkflowCard(input: {
  workflowId: string;
  stageId: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
}): Promise<void> {
  const { error } = await createClient().from("pro_workflow_cards").insert({
    workflow_id: input.workflowId,
    stage_id: input.stageId,
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    due_date: input.dueDate || null,
  });
  if (error) throw migrationError(error);
}

export async function updateProWorkflowCard(
  id: string,
  patch: { stageId?: string; title?: string; notes?: string | null; dueDate?: string | null; isExample?: boolean }
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.stageId !== undefined) values.stage_id = patch.stageId;
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.notes !== undefined) values.notes = patch.notes?.trim() || null;
  if (patch.dueDate !== undefined) values.due_date = patch.dueDate || null;
  if (patch.isExample !== undefined) values.is_example = patch.isExample;
  const { error } = await createClient().from("pro_workflow_cards").update(values).eq("id", id);
  if (error) throw migrationError(error);
}

export async function deleteProWorkflowCard(id: string): Promise<void> {
  const { error } = await createClient().from("pro_workflow_cards").delete().eq("id", id);
  if (error) throw migrationError(error);
}
