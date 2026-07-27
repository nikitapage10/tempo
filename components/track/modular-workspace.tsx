"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Layers, Lock, Plus, Unlink, X } from "lucide-react";
import {
  ALL_MODULE_IDS,
  LEFT_PCT_MAX,
  LEFT_PCT_MIN,
  clampLeftPct,
  hiddenModules,
  moduleLabel,
  slotId,
  type ColumnId,
  type ModuleId,
  type ModuleLayout,
  type ModuleSlot,
} from "@/lib/workspace-presets";
import { ModuleTabs } from "@/components/track/module-tabs";
import { cn } from "@/lib/utils";

type ModularWorkspaceProps = {
  layout: ModuleLayout;
  /** Rendered content per module. A missing/null entry is skipped (e.g. no permission). */
  modules: Partial<Record<ModuleId, React.ReactNode>>;
  editing: boolean;
  onChange: (layout: ModuleLayout) => void;
  /** Module that cannot be hidden (the waveform, once a track has versions). */
  lockedModule?: ModuleId | null;
  /** Optional count badges shown on grouped tabs (e.g. unresolved comments). */
  badges?: Partial<Record<ModuleId, number>>;
  compact?: boolean;
};

const COLUMN_IDS: Record<ColumnId, string> = {
  left: "column:left",
  right: "column:right",
};

export function ModularWorkspace({
  layout,
  modules,
  editing,
  onChange,
  lockedModule,
  badges,
  compact,
}: ModularWorkspaceProps) {
  // View mode renders the real modules with no drag wrappers at all — drag
  // listeners over a waveform or a form would fight the controls.
  if (!editing) {
    return (
      <SplitColumns
        leftPct={clampLeftPct(layout.leftPct)}
        onLeftPctChange={(pct) => onChange({ ...layout, leftPct: pct })}
        left={
          <Column gap={compact}>
            {layout.left.map((slot) => renderSlot(slot, modules, badges))}
          </Column>
        }
        right={
          <Column gap={compact}>
            {layout.right.map((slot) => renderSlot(slot, modules, badges))}
          </Column>
        }
      />
    );
  }

  return (
    <LayoutEditor
      layout={layout}
      modules={modules}
      onChange={onChange}
      lockedModule={lockedModule}
    />
  );
}

/**
 * Two columns with a draggable divider. Below `lg` the split collapses to a
 * stack and the handle is hidden — there's no width to trade on a phone.
 */
function SplitColumns({
  left,
  right,
  leftPct,
  onLeftPctChange,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  leftPct: number;
  onLeftPctChange: (pct: number) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  // Track width locally while dragging so it follows the pointer at 60fps
  // without a round trip through the parent on every move.
  const [livePct, setLivePct] = React.useState(leftPct);

  // Sync only when the stored width actually changes. Keying this on `dragging`
  // instead would snap the column back to the old width for the duration of
  // the save round-trip.
  React.useEffect(() => {
    setLivePct(leftPct);
  }, [leftPct]);

  React.useEffect(() => {
    if (!dragging) return;

    function pctFromClientX(clientX: number) {
      const row = rowRef.current;
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      if (rect.width === 0) return null;
      return clampLeftPct(((clientX - rect.left) / rect.width) * 100);
    }

    function onMove(e: PointerEvent) {
      const pct = pctFromClientX(e.clientX);
      if (pct != null) setLivePct(pct);
    }
    function onUp(e: PointerEvent) {
      const pct = pctFromClientX(e.clientX);
      setDragging(false);
      if (pct != null) onLeftPctChange(pct);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    // Stop the drag selecting text across the page.
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, onLeftPctChange]);

  function nudge(delta: number) {
    const next = clampLeftPct(livePct + delta);
    setLivePct(next);
    onLeftPctChange(next);
  }

  return (
    <div ref={rowRef} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 lg:shrink-0" style={{ flexBasis: `${livePct}%` }}>
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns"
        aria-valuenow={livePct}
        aria-valuemin={LEFT_PCT_MIN}
        aria-valuemax={LEFT_PCT_MAX}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            nudge(-2);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            nudge(2);
          }
        }}
        className={cn(
          // Wide invisible hit area (easy to grab) with a thin visible rule
          // and a grip pill inside, so it reads as a control rather than a border.
          "group relative hidden w-4 shrink-0 cursor-col-resize select-none items-center justify-center self-stretch lg:flex",
          "focus-visible:outline-none"
        )}
        title="Drag to resize columns · arrow keys to nudge"
      >
        {/* the rule */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-hover",
            dragging ? "bg-ice" : "bg-line group-hover:bg-ice/60"
          )}
        />
        {/* the grip — always visible so the divider is obviously draggable */}
        <span
          aria-hidden
          className={cn(
            "relative flex h-9 w-4 items-center justify-center gap-[3px] rounded-chip border transition-colors duration-hover",
            dragging
              ? "border-ice/70 bg-ice/20 shadow-e2"
              : "border-line bg-bg-3 shadow-e1 group-hover:border-ice/50 group-hover:bg-bg-2 group-focus-visible:border-ice group-focus-visible:ring-2 group-focus-visible:ring-ice"
          )}
        >
          <span
            className={cn(
              "h-3.5 w-px rounded-full transition-colors duration-hover",
              dragging ? "bg-ice" : "bg-text-lo group-hover:bg-ice"
            )}
          />
          <span
            className={cn(
              "h-3.5 w-px rounded-full transition-colors duration-hover",
              dragging ? "bg-ice" : "bg-text-lo group-hover:bg-ice"
            )}
          />
        </span>
        <span className="sr-only">
          Left column {livePct}% — drag or use arrow keys
        </span>
      </div>

      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}

function Column({
  children,
  className,
  gap,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: boolean;
}) {
  return (
    <div className={cn(gap ? "space-y-3" : "space-y-4", className)}>
      {children}
    </div>
  );
}

function renderSlot(
  slot: ModuleSlot,
  modules: Partial<Record<ModuleId, React.ReactNode>>,
  badges?: Partial<Record<ModuleId, number>>
) {
  const present = slot.filter((id) => modules[id]);
  if (present.length === 0) return null;
  return (
    <ModuleTabs
      key={present.join("+")}
      members={present}
      modules={modules}
      badges={badges}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Edit mode                                                           */
/* ------------------------------------------------------------------ */

function LayoutEditor({
  layout,
  modules,
  onChange,
  lockedModule,
}: {
  layout: ModuleLayout;
  modules: Partial<Record<ModuleId, React.ReactNode>>;
  onChange: (layout: ModuleLayout) => void;
  lockedModule?: ModuleId | null;
}) {
  const [dragging, setDragging] = React.useState<ModuleId | null>(null);
  // Set when the dragged tile is hovering the *middle* of another tile, which
  // means "merge into a tab group" rather than "reorder above/below it".
  const [combineTarget, setCombineTarget] = React.useState<ModuleId | null>(
    null
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragMove(event: DragMoveEvent) {
    const overId = event.over?.id as string | undefined;
    const overRect = event.over?.rect;
    const activeRect = event.active.rect.current.translated;
    if (
      !overId ||
      !overRect ||
      !activeRect ||
      overId === COLUMN_IDS.left ||
      overId === COLUMN_IDS.right ||
      overId === event.active.id
    ) {
      setCombineTarget(null);
      return;
    }
    // Middle 46% of the target reads as "combine"; the edges stay reorder.
    const centerY = activeRect.top + activeRect.height / 2;
    const band = overRect.height * 0.27;
    const inMiddle =
      centerY > overRect.top + band && centerY < overRect.top + overRect.height - band;
    setCombineTarget(inMiddle ? (overId as ModuleId) : null);
  }

  const available = hiddenModules(layout).filter((id) => modules[id]);

  function columnOfSlot(id: ModuleId): ColumnId | null {
    if (layout.left.some((s) => slotId(s) === id)) return "left";
    if (layout.right.some((s) => slotId(s) === id)) return "right";
    return null;
  }

  function findSlot(id: ModuleId): ModuleSlot | null {
    return (
      [...layout.left, ...layout.right].find((s) => slotId(s) === id) ?? null
    );
  }

  /** Resolves a drop target (slot id or column id) to a column. */
  function targetColumn(overId: string): ColumnId | null {
    if (overId === COLUMN_IDS.left) return "left";
    if (overId === COLUMN_IDS.right) return "right";
    return columnOfSlot(overId as ModuleId);
  }

  /** Removes a slot from both columns, returning the stripped layout. */
  function withoutSlot(id: ModuleId): ModuleLayout {
    return {
      ...layout,
      left: layout.left.filter((s) => slotId(s) !== id),
      right: layout.right.filter((s) => slotId(s) !== id),
    };
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = event.active.id as ModuleId;
    const overId = event.over?.id as string | undefined;
    if (!overId || combineTarget) return;

    const from = columnOfSlot(activeId);
    const to = targetColumn(overId);
    if (!from || !to || from === to) return;

    const slot = findSlot(activeId);
    if (!slot) return;

    const next = withoutSlot(activeId);
    const overIndex = next[to].findIndex((s) => slotId(s) === overId);
    const insertAt = overIndex >= 0 ? overIndex : next[to].length;
    next[to] = [
      ...next[to].slice(0, insertAt),
      slot,
      ...next[to].slice(insertAt),
    ];
    onChange(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id as ModuleId;
    const overId = event.over?.id as string | undefined;
    const combineInto = combineTarget;
    setDragging(null);
    setCombineTarget(null);
    if (!overId) return;

    // Dropped onto the body of another module → merge into one tabbed slot.
    if (combineInto && combineInto !== activeId) {
      const moving = findSlot(activeId);
      const target = findSlot(combineInto);
      if (!moving || !target) return;
      const stripped = withoutSlot(activeId);
      const col = stripped.left.some((s) => slotId(s) === combineInto)
        ? "left"
        : "right";
      onChange({
        ...stripped,
        [col]: stripped[col].map((s) =>
          slotId(s) === combineInto ? [...target, ...moving] : s
        ),
      });
      return;
    }

    const col = columnOfSlot(activeId);
    if (!col || overId === COLUMN_IDS[col]) return;

    const ids = layout[col].map(slotId);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId as ModuleId);
    if (from < 0 || to < 0 || from === to) return;

    onChange({ ...layout, [col]: arrayMove(layout[col], from, to) });
  }

  /** Hides one module. Removes just that member if it sits in a tab group. */
  function hide(id: ModuleId) {
    if (id === lockedModule) return;
    const strip = (slots: ModuleSlot[]) =>
      slots
        .map((s) => s.filter((m) => m !== id))
        .filter((s) => s.length > 0);
    onChange({
      ...layout,
      left: strip(layout.left),
      right: strip(layout.right),
    });
  }

  /** Pops a member out of its tab group into its own slot just below. */
  function ungroup(id: ModuleId) {
    const col = layout.left.some((s) => s.includes(id)) ? "left" : "right";
    const out: ModuleSlot[] = [];
    for (const s of layout[col]) {
      if (s.includes(id) && s.length > 1) {
        out.push(s.filter((m) => m !== id));
        out.push([id]);
      } else {
        out.push(s);
      }
    }
    onChange({ ...layout, [col]: out });
  }

  function add(id: ModuleId, col: ColumnId) {
    onChange({ ...layout, [col]: [...layout[col], [id]] });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setDragging(e.active.id as ModuleId)}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setCombineTarget(null);
      }}
    >
      <SplitColumns
        leftPct={clampLeftPct(layout.leftPct)}
        onLeftPctChange={(pct) => onChange({ ...layout, leftPct: pct })}
        left={
          <EditColumn
            column="left"
            label="Left column"
            slots={layout.left}
            modules={modules}
            lockedModule={lockedModule}
            combineTarget={combineTarget}
            onHide={hide}
            onUngroup={ungroup}
          />
        }
        right={
          <EditColumn
            column="right"
            label="Right column"
            slots={layout.right}
            modules={modules}
            lockedModule={lockedModule}
            combineTarget={combineTarget}
            onHide={hide}
            onUngroup={ungroup}
          />
        }
      />

      {available.length > 0 ? (
        <div className="panel-quiet mt-4 p-4">
          <p className="label-mono mb-3">Hidden — click to add</p>
          <div className="flex flex-wrap gap-2">
            {available.map((id) => (
              <div key={id} className="flex items-center overflow-hidden rounded-chip border border-line">
                <span className="px-3 py-1 text-xs text-text-lo">
                  {moduleLabel(id)}
                </span>
                <button
                  type="button"
                  onClick={() => add(id, "left")}
                  className="border-l border-line px-2 py-1 text-[11px] text-ice transition-colors duration-hover hover:bg-ice/10"
                  aria-label={`Add ${moduleLabel(id)} to the left column`}
                >
                  <Plus className="mr-0.5 inline size-3" />L
                </button>
                <button
                  type="button"
                  onClick={() => add(id, "right")}
                  className="border-l border-line px-2 py-1 text-[11px] text-ice transition-colors duration-hover hover:bg-ice/10"
                  aria-label={`Add ${moduleLabel(id)} to the right column`}
                >
                  <Plus className="mr-0.5 inline size-3" />R
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DragOverlay>
        {dragging ? <Tile slot={findSlot(dragging) ?? [dragging]} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function EditColumn({
  column,
  label,
  slots,
  modules,
  lockedModule,
  combineTarget,
  onHide,
  onUngroup,
  className,
}: {
  column: ColumnId;
  label: string;
  slots: ModuleSlot[];
  modules: Partial<Record<ModuleId, React.ReactNode>>;
  lockedModule?: ModuleId | null;
  combineTarget?: ModuleId | null;
  onHide: (id: ModuleId) => void;
  onUngroup: (id: ModuleId) => void;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_IDS[column] });
  const visible = slots
    .map((s) => s.filter((id) => modules[id]))
    .filter((s) => s.length > 0);

  return (
    <div className={className}>
      <p className="label-mono mb-2">{label}</p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[160px] space-y-2 rounded-panel border border-dashed p-3 transition-colors duration-hover",
          isOver ? "border-ice/50 bg-ice/[0.04]" : "border-line bg-bg-0/30"
        )}
      >
        <SortableContext
          items={visible.map(slotId)}
          strategy={verticalListSortingStrategy}
        >
          {visible.map((slot) => (
            <SortableTile
              key={slotId(slot)}
              slot={slot}
              locked={slot.includes(lockedModule as ModuleId)}
              lockedModule={lockedModule}
              combining={combineTarget === slotId(slot)}
              onHide={onHide}
              onUngroup={onUngroup}
            />
          ))}
        </SortableContext>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-text-lo/60">
            Drag a module here
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SortableTile({
  slot,
  locked,
  lockedModule,
  combining,
  onHide,
  onUngroup,
}: {
  slot: ModuleSlot;
  locked?: boolean;
  lockedModule?: ModuleId | null;
  combining?: boolean;
  onHide: (id: ModuleId) => void;
  onUngroup: (id: ModuleId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slotId(slot) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <Tile
        slot={slot}
        locked={locked}
        lockedModule={lockedModule}
        combining={combining}
        onHide={onHide}
        onUngroup={onUngroup}
        handleProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
}

function Tile({
  slot,
  locked,
  lockedModule,
  combining,
  onHide,
  onUngroup,
  handleProps,
  overlay,
}: {
  slot: ModuleSlot;
  locked?: boolean;
  lockedModule?: ModuleId | null;
  combining?: boolean;
  onHide?: (id: ModuleId) => void;
  onUngroup?: (id: ModuleId) => void;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const grouped = slot.length > 1;

  return (
    <div
      className={cn(
        "rounded-card border bg-gradient-to-b from-[#17171e] to-bg-1 shadow-e1 transition-[box-shadow,border-color] duration-hover",
        combining
          ? "border-ice bg-ice/[0.07] ring-2 ring-ice/60"
          : "border-line",
        overlay && "shadow-e3 ring-1 ring-ice/50"
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span
          {...handleProps}
          className="cursor-grab touch-none text-text-lo active:cursor-grabbing"
          aria-label={`Reorder ${slot.map(moduleLabel).join(", ")}`}
        >
          <GripVertical className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-text-hi">
          {grouped ? (
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 shrink-0 text-ice" />
              <span className="truncate">{slot.length} tabs</span>
            </span>
          ) : (
            moduleLabel(slot[0])
          )}
        </span>
        {!grouped ? (
          locked ? (
            <span
              className="text-text-lo/60"
              title="The waveform stays visible while this track has bounces"
            >
              <Lock className="size-3.5" aria-label="Required" />
            </span>
          ) : onHide ? (
            <button
              type="button"
              onClick={() => onHide(slot[0])}
              className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
              aria-label={`Hide ${moduleLabel(slot[0])}`}
            >
              <X className="size-3.5" />
            </button>
          ) : null
        ) : null}
      </div>

      {grouped ? (
        <ul className="space-y-1 border-t border-line/70 px-2.5 py-2">
          {slot.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-text-lo">
                {moduleLabel(id)}
              </span>
              {onUngroup ? (
                <button
                  type="button"
                  onClick={() => onUngroup(id)}
                  className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-ice"
                  aria-label={`Move ${moduleLabel(id)} out of this group`}
                  title="Split out of group"
                >
                  <Unlink className="size-3" />
                </button>
              ) : null}
              {id === lockedModule ? (
                <span className="p-1 text-text-lo/60" title="Required">
                  <Lock className="size-3" aria-label="Required" />
                </span>
              ) : onHide ? (
                <button
                  type="button"
                  onClick={() => onHide(id)}
                  className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
                  aria-label={`Hide ${moduleLabel(id)}`}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {combining ? (
        <p className="border-t border-ice/30 px-2.5 py-1.5 text-[11px] text-ice">
          Drop to combine into tabs
        </p>
      ) : null}
    </div>
  );
}

export { ALL_MODULE_IDS };
