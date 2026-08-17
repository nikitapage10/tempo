"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGroup, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Lightbulb,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { useActiveSpace } from "@/components/active-space-provider";
import { BoardStageSlot } from "@/components/board/board-stage-slot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropIndicator } from "@/components/ui/drop-indicator";
import { Input } from "@/components/ui/input";
import { useLayoutMove, useLayoutOverflowUnlock } from "@/components/ui/layout-item";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useProWorkflowMutations, useProWorkflows } from "@/hooks/use-pro-workflows";
import { fetchMemberPassage } from "@/lib/api/member-passage";
import {
  BOARD_FOCUS_COUNT,
  boardFocusGridTemplate,
  clampBoardFocusStart,
  focusStartForStage,
} from "@/lib/board/view";
import { workflowSeedsForRoles } from "@/lib/pro-workflows/templates";
import type {
  ProWorkflow,
  ProWorkflowCard,
  ProWorkflowStage,
} from "@/lib/pro-workflows/types";
import { cn } from "@/lib/utils";
import { insertIdBefore, isNoOpInsert, ranksForIds } from "@/lib/dnd/insert";
import {
  parseDropSlotId,
  sameDropSlot,
  type DropSlot,
} from "@/lib/dnd/drop-slot";

const proBoardCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCorners(args);
};

function proFlowCardDragId(cardId: string) {
  return `pro-flow-card:${cardId}`;
}

function parseProFlowCardDragId(id: string): string | null {
  return id.startsWith("pro-flow-card:") ? id.slice(14) : null;
}

function proFlowStageDropId(stageId: string) {
  return `pro-flow-stage:${stageId}`;
}

function parseProFlowStageDropId(id: string): string | null {
  return id.startsWith("pro-flow-stage:") ? id.slice(15) : null;
}

const selectClass =
  "h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice";

const stageHues = ["#7FB4FF", "#A9C9F5", "#F2F0EB", "#E8C49D", "#FFB56B", "#D99261"];

function hueForStage(index: number, count: number) {
  if (count <= 1) return stageHues[0];
  return stageHues[Math.round((index / (count - 1)) * (stageHues.length - 1))];
}

function ProFlowCard({
  card,
  stages,
  onMove,
  onRemove,
  overlay = false,
}: {
  card: ProWorkflowCard;
  stages: ProWorkflowStage[];
  onMove?: (stageId: string) => void;
  onRemove?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: proFlowCardDragId(card.id),
    disabled: overlay,
    data: { kind: "pro-flow-card", card },
  });
  const layoutMove = useLayoutMove(`pro-flow-card-${card.id}`, !overlay);
  const dragProps = overlay ? {} : { ...listeners, ...attributes };

  return (
    <motion.article
      {...layoutMove}
      {...dragProps}
      ref={setNodeRef}
      className={cn(
        "rounded-card border border-line bg-bg-1/95 p-3 shadow-e1",
        !overlay && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-35",
        overlay && "w-[min(340px,82vw)] rotate-1 border-ice/50 shadow-raise"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {card.isExample ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-chip bg-ice/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ice">
              <Lightbulb className="size-3" /> Starting idea
            </span>
          ) : null}
          <h3 className="text-sm font-medium text-text-hi">{card.title}</h3>
          {card.notes ? (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-text-lo">{card.notes}</p>
          ) : null}
        </div>
        {!overlay && onRemove ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="rounded-input p-1 text-text-lo/60 hover:bg-warn/10 hover:text-warn"
            aria-label={`Remove ${card.title}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      {card.dueDate ? (
        <span className="mt-3 inline-flex items-center gap-1 rounded-chip bg-bg-2 px-2 py-0.5 font-data text-[11px] text-text-lo">
          <CalendarDays className="size-3" /> {card.dueDate}
        </span>
      ) : null}
      {!overlay && onMove ? (
        <select
          value={card.stageId}
          onChange={(event) => onMove(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Stage for ${card.title}`}
          className="mt-3 h-7 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>{stage.name}</option>
          ))}
        </select>
      ) : null}
    </motion.article>
  );
}

function ProFlowColumn({
  stage,
  stageIndex,
  stageCount,
  cards,
  stages,
  isOver,
  onMove,
  onRemove,
  onAdd,
  allowOverflow,
  showInsertSlots,
  activeSlot,
}: {
  stage: ProWorkflowStage;
  stageIndex: number;
  stageCount: number;
  cards: ProWorkflowCard[];
  stages: ProWorkflowStage[];
  isOver: boolean;
  onMove: (card: ProWorkflowCard, stageId: string) => void;
  onRemove: (card: ProWorkflowCard) => void;
  onAdd: (stageId: string) => void;
  allowOverflow?: boolean;
  showInsertSlots?: boolean;
  activeSlot?: DropSlot | null;
}) {
  const { setNodeRef } = useDroppable({
    id: proFlowStageDropId(stage.id),
    data: { stageId: stage.id },
  });
  const hue = hueForStage(stageIndex, stageCount);
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[260px] min-w-0 flex-col rounded-panel border border-line bg-gradient-to-b from-[rgb(20_20_25/0.76)] to-[rgb(14_14_18/0.62)] p-3 shadow-e2 backdrop-blur-xl transition-colors",
        allowOverflow ? "overflow-visible" : "overflow-hidden",
        isOver && "border-ice/50 bg-ice/[0.06]"
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: `linear-gradient(180deg, ${hue}16, transparent)` }} />
      <header className="relative mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold text-text-hi">{stage.name}</h2>
            {stage.description ? <p className="mt-1 line-clamp-2 text-xs text-text-lo">{stage.description}</p> : null}
          </div>
          <span className="rounded-chip bg-bg-3 px-2 py-0.5 font-data text-[11px] text-text-lo">{cards.length}</span>
        </div>
        <div className="mt-3 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${hue}aa, transparent)` }} />
      </header>
      <div className="relative flex flex-1 flex-col gap-2">
        {cards.length === 0 ? (
          <>
            {showInsertSlots ? (
              <DropIndicator
                slot={{ kind: "pro", containerId: stage.id, beforeId: null }}
                active={
                  activeSlot?.kind === "pro" &&
                  activeSlot.containerId === stage.id &&
                  activeSlot.beforeId == null
                }
              />
            ) : null}
            <div className="flex min-h-28 flex-1 items-center justify-center rounded-card border border-dashed border-line/70 bg-bg-0/25 px-3 text-center text-xs text-text-lo/70">
              {isOver ? <span className="text-ice">Drop to move here</span> : "This stage is clear."}
            </div>
          </>
        ) : (
          cards.map((card) => {
            const slot = {
              kind: "pro" as const,
              containerId: stage.id,
              beforeId: card.id,
            };
            return (
              <React.Fragment key={card.id}>
                {showInsertSlots ? (
                  <DropIndicator
                    slot={slot}
                    active={
                      activeSlot?.kind === "pro" &&
                      activeSlot.containerId === stage.id &&
                      activeSlot.beforeId === card.id
                    }
                  />
                ) : null}
                <ProFlowCard
                  card={card}
                  stages={stages}
                  onMove={(stageId) => onMove(card, stageId)}
                  onRemove={() => onRemove(card)}
                />
              </React.Fragment>
            );
          })
        )}
        {showInsertSlots && cards.length > 0 ? (
          <DropIndicator
            slot={{ kind: "pro", containerId: stage.id, beforeId: null }}
            active={
              activeSlot?.kind === "pro" &&
              activeSlot.containerId === stage.id &&
              activeSlot.beforeId == null
            }
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onAdd(stage.id)}
        className="relative mt-3 flex items-center justify-center gap-1.5 rounded-input border border-dashed border-line px-3 py-2 text-xs text-text-lo hover:border-ice/40 hover:text-ice"
      >
        <Plus className="size-3.5" /> Add work item
      </button>
    </section>
  );
}

function ProFlowRail({
  stage,
  count,
  onOpen,
}: {
  stage: ProWorkflowStage;
  count: number;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `pro-flow-stage:${stage.id}`, data: { stageId: stage.id } });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex min-h-12 w-full items-center gap-3 rounded-panel border border-line bg-bg-1/75 px-3 text-left shadow-e1 lg:min-h-[260px] lg:w-12 lg:flex-col lg:px-0 lg:py-3",
        "hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        isOver && "border-ice/50 bg-ice/[0.06]"
      )}
      aria-label={`Open ${stage.name}, ${count} items`}
    >
      <span className="order-2 min-w-0 flex-1 truncate font-display text-xs text-text-lo group-hover:text-text-hi lg:order-3 lg:flex-none lg:[text-orientation:mixed] lg:[writing-mode:vertical-rl]">{stage.name}</span>
      <span className="order-1 rounded-chip bg-bg-3 px-1.5 py-0.5 font-data text-[11px] text-text-lo lg:order-2">{count}</span>
      <ChevronRight className="order-3 ml-auto size-3.5 text-text-lo/50 group-hover:text-ice lg:mt-auto lg:ml-0 lg:rotate-90" />
    </button>
  );
}

export function ProWorkflowBoard() {
  const { activeSpace, activeSpaceId, isLoading: spaceLoading } = useActiveSpace();
  const bundleQuery = useProWorkflows(activeSpaceId);
  const mutations = useProWorkflowMutations(activeSpaceId);
  const passageQuery = useQuery({ queryKey: ["member-passage", "workflow-seeds"], queryFn: fetchMemberPassage });
  const { toast } = useToast();
  const seededRef = React.useRef<string | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = React.useState<string | null>(null);
  const [focusStart, setFocusStart] = React.useState(0);
  const [overStageId, setOverStageId] = React.useState<string | null>(null);
  const [overSlot, setOverSlot] = React.useState<DropSlot | null>(null);
  const [activeCard, setActiveCard] = React.useState<ProWorkflowCard | null>(null);
  const [cardTitle, setCardTitle] = React.useState("");
  const [cardNotes, setCardNotes] = React.useState("");
  const [cardDueDate, setCardDueDate] = React.useState("");
  const [cardStageId, setCardStageId] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [newWorkflowOpen, setNewWorkflowOpen] = React.useState(false);
  const [newWorkflowName, setNewWorkflowName] = React.useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = React.useState("");
  const [editWorkflowName, setEditWorkflowName] = React.useState("");
  const [editWorkflowDescription, setEditWorkflowDescription] = React.useState("");
  const [newStageName, setNewStageName] = React.useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const allowOverflow = useLayoutOverflowUnlock(Boolean(activeCard));

  const roles = React.useMemo(() => {
    const passage = passageQuery.data;
    if (!passage) return [];
    return [...passage.roleTitles, ...(passage.roleTitleOther ? [passage.roleTitleOther] : [])];
  }, [passageQuery.data]);
  const suggestedSeeds = React.useMemo(() => workflowSeedsForRoles(roles), [roles]);
  const workflows = React.useMemo(() => bundleQuery.data?.workflows ?? [], [bundleQuery.data]);
  const activeWorkflow = workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0] ?? null;

  React.useEffect(() => {
    if (!activeSpaceId || !bundleQuery.data || passageQuery.isLoading) return;
    if (bundleQuery.data.initialized || seededRef.current === activeSpaceId) return;
    seededRef.current = activeSpaceId;
    mutations.installSeeds.mutate(suggestedSeeds, {
      onError: (error) => toast(error instanceof Error ? error.message : "Couldn't shape your starting workflows."),
    });
  }, [activeSpaceId, bundleQuery.data, passageQuery.isLoading, suggestedSeeds, mutations.installSeeds, toast]);

  React.useEffect(() => {
    if (activeWorkflow && activeWorkflow.id !== activeWorkflowId) setActiveWorkflowId(activeWorkflow.id);
  }, [activeWorkflow, activeWorkflowId]);

  React.useEffect(() => {
    setFocusStart((current) => clampBoardFocusStart(activeWorkflow?.stages.length ?? 0, current));
    setCardStageId(activeWorkflow?.stages[0]?.id ?? "");
  }, [activeWorkflow?.id, activeWorkflow?.stages.length]);

  function openCustomize() {
    if (!activeWorkflow) return;
    setEditWorkflowName(activeWorkflow.name);
    setEditWorkflowDescription(activeWorkflow.description ?? "");
    setCustomizeOpen(true);
  }

  async function addCard(event: React.FormEvent) {
    event.preventDefault();
    if (!activeWorkflow || !cardTitle.trim() || !cardStageId) return;
    try {
      await mutations.createCard.mutateAsync({
        workflowId: activeWorkflow.id,
        stageId: cardStageId,
        title: cardTitle,
        notes: cardNotes,
        dueDate: cardDueDate,
      });
      setCardTitle(""); setCardNotes(""); setCardDueDate(""); setCreateOpen(false);
      toast("Added to the workflow.", "ok");
    } catch (error) { toast(error instanceof Error ? error.message : "Couldn't add that work item."); }
  }

  async function moveCard(card: ProWorkflowCard, stageId: string) {
    if (card.stageId === stageId) return;
    try {
      await mutations.updateCard.mutateAsync({ id: card.id, patch: { stageId, isExample: false } });
    } catch (error) { toast(error instanceof Error ? error.message : "Couldn't move that work item."); }
  }

  function cardIdsInStage(stageId: string, excludeId?: string) {
    return (activeWorkflow?.cards ?? [])
      .filter((item) => item.stageId === stageId && item.id !== excludeId)
      .sort((a, b) => a.sort - b.sort)
      .map((item) => item.id);
  }

  function resolveOverStage(overId: string): string | null {
    const slot = parseDropSlotId(overId);
    if (slot) return slot.containerId;
    return parseProFlowStageDropId(overId);
  }

  function resolveDropSlot(overId: string): DropSlot | null {
    const slot = parseDropSlotId(overId);
    if (slot?.kind === "pro") return slot;
    const stageId = parseProFlowStageDropId(overId);
    if (stageId) return { kind: "pro", containerId: stageId, beforeId: null };
    const cardId = parseProFlowCardDragId(overId);
    if (cardId) {
      const card = activeWorkflow?.cards.find((item) => item.id === cardId);
      return card
        ? { kind: "pro", containerId: card.stageId, beforeId: card.id }
        : null;
    }
    return null;
  }

  function clearDragState() {
    setActiveCard(null);
    setOverStageId(null);
    setOverSlot(null);
  }

  async function persistCardPlacement(
    cardId: string,
    stageId: string,
    beforeId: string | null
  ) {
    const card = activeWorkflow?.cards.find((item) => item.id === cardId);
    if (!card) return;
    const sameStage = card.stageId === stageId;
    const originalIds = sameStage ? cardIdsInStage(stageId) : [];
    const targetIds = cardIdsInStage(stageId, cardId);
    const nextIds = insertIdBefore(targetIds, cardId, beforeId);
    if (sameStage && isNoOpInsert(originalIds, cardId, beforeId)) return;

    try {
      await Promise.all(
        ranksForIds(nextIds).map(({ id, sort }) =>
          mutations.updateCard.mutateAsync({
            id,
            patch: {
              sort,
              isExample: false,
              ...(id === cardId && !sameStage ? { stageId } : {}),
            },
          })
        )
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't move that work item.");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCard((event.active.data.current?.card as ProWorkflowCard | undefined) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (!overId) {
      setOverStageId(null);
      setOverSlot(null);
      return;
    }
    const id = String(overId);
    setOverStageId(resolveOverStage(id));
    const slot = resolveDropSlot(id);
    const activeCardId = parseProFlowCardDragId(String(event.active.id));
    if (slot && slot.beforeId !== activeCardId) {
      setOverSlot((prev) => (sameDropSlot(prev, slot) ? prev : slot));
    } else {
      setOverSlot(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = (event.active.data.current?.card as ProWorkflowCard | undefined) ?? null;
    const slot = overSlot;
    clearDragState();
    const { over } = event;
    if (!card || !over) return;
    const resolved = slot ?? resolveDropSlot(String(over.id));
    if (!resolved || resolved.kind !== "pro") return;
    void persistCardPlacement(card.id, resolved.containerId, resolved.beforeId);
  }

  if (spaceLoading || bundleQuery.isLoading || (!bundleQuery.data?.initialized && mutations.installSeeds.isPending)) {
    return <div className="grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-panel border border-line bg-bg-1" />)}</div>;
  }

  if (bundleQuery.error) {
    return <div className="panel p-6"><h1 className="font-display text-xl text-text-hi">Workflow boards are not ready yet</h1><p className="mt-2 text-sm text-text-lo">{bundleQuery.error instanceof Error ? bundleQuery.error.message : "Run the latest database migration, then reload."}</p></div>;
  }

  const stages = activeWorkflow?.stages ?? [];
  const cardsByStage = new Map(
    stages.map((stage) => [
      stage.id,
      (activeWorkflow?.cards.filter((card) => card.stageId === stage.id) ?? []).sort(
        (a, b) => a.sort - b.sort
      ),
    ])
  );

  return (
    <div className="py-2">
      <PageHeader
        title="Workflow board"
        subtitle={`See larger pieces of professional work move through ${activeSpace?.name ?? "this Pro Space"}. Tasks stay in Tasks.`}
        actions={<><Button type="button" variant="secondary" onClick={() => setCreateOpen(true)} disabled={!activeWorkflow}><Plus /> Work item</Button><Button type="button" variant="secondary" onClick={openCustomize} disabled={!activeWorkflow}><Settings2 /> Customize</Button></>}
      />

      <div className="panel-quiet mb-4 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex max-w-3xl gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-amber" /><div><p className="text-sm font-medium text-text-hi">A starting point shaped around your roles</p><p className="mt-1 text-xs leading-5 text-text-lo">These are ideas, not rules. Rename workflows, change every stage, remove the examples, or build a completely different flow. Use cards for the larger journey; keep individual actions in Tasks.</p></div></div>
        <Button type="button" variant="ghost" size="sm" disabled={mutations.installSeeds.isPending} onClick={() => mutations.installSeeds.mutate(suggestedSeeds, { onSuccess: () => toast("Your role-based workflow ideas are available.", "ok"), onError: (error) => toast(error instanceof Error ? error.message : "Couldn't add those ideas.") })}><Lightbulb /> Add role ideas</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-stretch gap-2" aria-label="Professional workflows">
        {workflows.map((workflow) => (
          <button key={workflow.id} type="button" onClick={() => { setActiveWorkflowId(workflow.id); setFocusStart(0); }} className={cn("min-w-[180px] flex-1 rounded-card border px-3 py-3 text-left transition-colors sm:max-w-[280px]", activeWorkflow?.id === workflow.id ? "border-ice/45 bg-ice/[0.07]" : "border-line bg-bg-1/65 hover:border-white/15")}>
            <span className="flex items-center justify-between gap-2"><span className="font-display text-sm font-semibold text-text-hi">{workflow.name}</span><span className="rounded-chip bg-bg-3 px-2 py-0.5 font-data text-[11px] text-text-lo">{workflow.cards.length}</span></span>
            {workflow.description ? <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-text-lo">{workflow.description}</span> : null}
          </button>
        ))}
        <button type="button" onClick={() => { setNewWorkflowName(""); setNewWorkflowDescription(""); setNewWorkflowOpen(true); }} className="min-h-[76px] min-w-[150px] rounded-card border border-dashed border-line px-4 text-sm text-text-lo hover:border-ice/40 hover:text-ice"><Plus className="mx-auto mb-1 size-4" />New workflow</button>
      </div>

      {!activeWorkflow ? (
        <div className="panel flex min-h-64 flex-col items-center justify-center p-6 text-center"><h2 className="font-display text-lg text-text-hi">Build the flow that fits your work</h2><p className="mt-2 max-w-lg text-sm text-text-lo">Add your role ideas above, or create a workflow from scratch. Nothing here changes access or creates tasks.</p></div>
      ) : stages.length === 0 ? (
        <div className="panel p-6 text-center"><p className="text-sm text-text-lo">This workflow needs at least one stage. Open Customize to add it.</p></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={proBoardCollision} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragCancel={clearDragState} onDragEnd={handleDragEnd}>
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-text-hi">{activeWorkflow.name}</h2>{activeWorkflow.description ? <p className="mt-1 text-xs text-text-lo">{activeWorkflow.description}</p> : null}</div>{stages.length > BOARD_FOCUS_COUNT ? <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label="Earlier stages" disabled={focusStart === 0} onClick={() => setFocusStart((value) => clampBoardFocusStart(stages.length, value - 1))}><ChevronLeft /></Button><Button type="button" variant="ghost" size="icon" aria-label="Later stages" disabled={focusStart >= stages.length - BOARD_FOCUS_COUNT} onClick={() => setFocusStart((value) => clampBoardFocusStart(stages.length, value + 1))}><ChevronRight /></Button></div> : null}</div>
          <LayoutGroup id="tempo-pro-board">
          <div data-pro-board data-pro-workflow-board className={cn("flex flex-col gap-3 lg:grid lg:items-stretch lg:transition-[grid-template-columns] lg:duration-300 motion-reduce:transition-none", allowOverflow ? "lg:overflow-visible" : "lg:overflow-hidden")} style={{ gridTemplateColumns: boardFocusGridTemplate(stages.length, focusStart) }}>
            {stages.map((stage, index) => {
              const expanded = index >= focusStart && index < focusStart + BOARD_FOCUS_COUNT;
              const cards = cardsByStage.get(stage.id) ?? [];
              return <BoardStageSlot key={stage.id} expanded={expanded} overflowVisible={allowOverflow} expandedContent={<ProFlowColumn stage={stage} stageIndex={index} stageCount={stages.length} cards={cards} stages={stages} isOver={overStageId === stage.id} allowOverflow={allowOverflow} showInsertSlots={Boolean(activeCard)} activeSlot={overSlot?.kind === "pro" && overSlot.containerId === stage.id ? overSlot : null} onMove={(card, stageId) => void moveCard(card, stageId)} onRemove={(card) => mutations.deleteCard.mutate(card.id)} onAdd={(stageId) => { setCardStageId(stageId); setCreateOpen(true); }} />} railContent={<ProFlowRail stage={stage} count={cards.length} onOpen={() => setFocusStart((current) => focusStartForStage(stages.length, current, index))} />} />;
            })}
          </div>
          </LayoutGroup>
          <DragOverlay dropAnimation={null}>{activeCard ? <ProFlowCard card={activeCard} stages={stages} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent title="Add a workflow item" description="A campaign, opportunity, release, booking, or other piece of work with a journey." onClose={() => setCreateOpen(false)}><form onSubmit={addCard} className="space-y-3"><Input value={cardTitle} onChange={(event) => setCardTitle(event.target.value)} placeholder="What is moving through this flow?" autoFocus /><Textarea value={cardNotes} onChange={(event) => setCardNotes(event.target.value)} placeholder="Context or intended outcome (optional)" rows={3} /><div className="grid gap-3 sm:grid-cols-2"><select value={cardStageId} onChange={(event) => setCardStageId(event.target.value)} className={selectClass}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><Input type="date" value={cardDueDate} onChange={(event) => setCardDueDate(event.target.value)} /></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={!cardTitle.trim() || !cardStageId || mutations.createCard.isPending}>Add item</Button></div></form></DialogContent></Dialog>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}><DialogContent title="Customize this workflow" description="The starting stages are only suggestions. Make the language match how you actually work." onClose={() => setCustomizeOpen(false)} className="max-w-2xl"><div className="space-y-4"><div className="grid gap-2"><Input value={editWorkflowName} onChange={(event) => setEditWorkflowName(event.target.value)} aria-label="Workflow name" /><Textarea value={editWorkflowDescription} onChange={(event) => setEditWorkflowDescription(event.target.value)} rows={2} aria-label="Workflow description" /><Button type="button" variant="secondary" onClick={() => activeWorkflow && mutations.updateWorkflow.mutate({ id: activeWorkflow.id, patch: { name: editWorkflowName, description: editWorkflowDescription } })}>Save workflow details</Button></div><div className="border-t border-line pt-4"><h3 className="text-sm font-semibold text-text-hi">Stages</h3><div className="mt-2 space-y-2">{activeWorkflow?.stages.map((stage, index) => <StageEditRow key={stage.id} stage={stage} canRemove={(activeWorkflow?.stages.length ?? 0) > 1} onSave={(name) => mutations.updateStage.mutate({ id: stage.id, patch: { name } })} onMove={(direction) => { if (!activeWorkflow) return; const other = activeWorkflow.stages[index + direction]; if (!other) return; void Promise.all([mutations.updateStage.mutateAsync({ id: stage.id, patch: { sort: other.sort } }), mutations.updateStage.mutateAsync({ id: other.id, patch: { sort: stage.sort } })]); }} onRemove={() => { if (!activeWorkflow) return; const destination = activeWorkflow.stages.find((item) => item.id !== stage.id); if (destination) mutations.deleteStage.mutate({ stageId: stage.id, moveCardsToStageId: destination.id }); }} first={index === 0} last={index === (activeWorkflow?.stages.length ?? 0) - 1} />)}</div><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!activeWorkflow || !newStageName.trim()) return; mutations.createStage.mutate({ workflowId: activeWorkflow.id, input: { name: newStageName, sort: ((activeWorkflow.stages.at(-1)?.sort ?? 0) + 100) } }, { onSuccess: () => setNewStageName("") }); }}><Input value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Add another stage" /><Button type="submit" variant="secondary" disabled={!newStageName.trim()}><Plus /> Stage</Button></form></div><div className="flex justify-between border-t border-line pt-4"><Button type="button" variant="destructive" onClick={() => { if (!activeWorkflow) return; if (window.confirm(`Delete ${activeWorkflow.name} and its workflow cards? Tasks are not affected.`)) { mutations.deleteWorkflow.mutate(activeWorkflow.id); setCustomizeOpen(false); } }}><Trash2 /> Delete workflow</Button><Button type="button" onClick={() => setCustomizeOpen(false)}>Done</Button></div></div></DialogContent></Dialog>

      <NewWorkflowDialog open={newWorkflowOpen} onOpenChange={setNewWorkflowOpen} name={newWorkflowName} description={newWorkflowDescription} setName={setNewWorkflowName} setDescription={setNewWorkflowDescription} onCreate={async () => { if (!newWorkflowName.trim()) return; await mutations.createWorkflow.mutateAsync({ name: newWorkflowName, description: newWorkflowDescription }); setNewWorkflowName(""); setNewWorkflowDescription(""); }} />
    </div>
  );
}

function StageEditRow({ stage, canRemove, onSave, onMove, onRemove, first, last }: { stage: ProWorkflowStage; canRemove: boolean; onSave: (name: string) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean }) {
  const [name, setName] = React.useState(stage.name);
  React.useEffect(() => setName(stage.name), [stage.name]);
  return <div className="flex items-center gap-2 rounded-input border border-line bg-bg-2/55 p-2"><Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() && name.trim() !== stage.name && onSave(name)} aria-label={`Stage name ${stage.name}`} /><button type="button" onClick={() => onMove(-1)} disabled={first} className="p-1 text-text-lo hover:text-ice disabled:opacity-30" aria-label={`Move ${stage.name} earlier`}><ChevronUp className="size-4" /></button><button type="button" onClick={() => onMove(1)} disabled={last} className="p-1 text-text-lo hover:text-ice disabled:opacity-30" aria-label={`Move ${stage.name} later`}><ChevronDown className="size-4" /></button><button type="button" onClick={onRemove} disabled={!canRemove} className="p-1 text-text-lo hover:text-warn disabled:opacity-30" aria-label={`Remove ${stage.name}`}><Trash2 className="size-4" /></button></div>;
}

function NewWorkflowDialog({ open, onOpenChange, name, description, setName, setDescription, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; name: string; description: string; setName: (value: string) => void; setDescription: (value: string) => void; onCreate: () => Promise<void> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="New workflow" description="Start simple. You can rename, add, remove, and reorder every stage afterward." onClose={() => onOpenChange(false)}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void onCreate().then(() => onOpenChange(false)); }}><Input id="new-pro-workflow-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Workflow name" autoFocus /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What moves through this workflow?" rows={3} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!name.trim()}>Create workflow</Button></div></form></DialogContent></Dialog>;
}
