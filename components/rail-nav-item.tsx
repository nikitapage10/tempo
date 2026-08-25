"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import * as React from "react";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

export type RailLeaf = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type RailItem = RailLeaf & {
  children?: readonly RailLeaf[];
};

export function isRailHrefActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isRailItemActive(pathname: string, item: RailItem) {
  if (isRailHrefActive(pathname, item.href)) return true;
  return (item.children ?? []).some((child) => isRailHrefActive(pathname, child.href));
}

/** Phone More sheet: parent plus unique children, so Network does not duplicate Social. */
export function flattenRailItems(items: readonly RailItem[]): RailLeaf[] {
  const out: RailLeaf[] = [];
  for (const item of items) {
    out.push({ href: item.href, label: item.label, icon: item.icon });
    for (const child of item.children ?? []) {
      if (child.href !== item.href) out.push(child);
    }
  }
  return out;
}

/** Grace to travel from the rail label into its own submenu. */
export const RAIL_FLYOUT_CLOSE_MS = 180;
/**
 * Only used when a neighbor was blocked because the pointer was aiming at the
 * open menu, then stopped. Intentional switches (down the rail) are instant.
 */
export const RAIL_FLYOUT_SETTLE_MS = 90;

export type FlyoutPoint = { x: number; y: number };
export type FlyoutRect = { left: number; top: number; right: number; bottom: number };

export function distanceToRect(p: FlyoutPoint, r: FlyoutRect): number {
  const x = p.x < r.left ? r.left : p.x > r.right ? r.right : p.x;
  const y = p.y < r.top ? r.top : p.y > r.bottom ? r.bottom : p.y;
  return Math.hypot(p.x - x, p.y - y);
}

/**
 * Keep the open submenu while the pointer is traveling into it (down-right
 * toward Stats). Straight down the rail onto Social is not aim — switch now.
 */
export function isPointerAimingAtFlyout(
  from: FlyoutPoint,
  to: FlyoutPoint,
  flyout: FlyoutRect
): boolean {
  if (
    to.x >= flyout.left &&
    to.x <= flyout.right &&
    to.y >= flyout.top &&
    to.y <= flyout.bottom
  ) {
    return true;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx * dx + dy * dy < 4) return false;
  // Panels open to the right of the rail. Vertical / leftward motion is a switch.
  if (dx <= 1) return false;
  return distanceToRect(to, flyout) < distanceToRect(from, flyout);
}

type RailFlyoutApi = {
  openId: string | null;
  enter: (id: string, opts?: { immediate?: boolean }) => void;
  leave: () => void;
  dismiss: () => void;
  registerPanel: (id: string, el: HTMLElement | null) => void;
};

const RailFlyoutContext = React.createContext<RailFlyoutApi | null>(null);

function clearTimer(ref: React.MutableRefObject<number | null>) {
  if (ref.current != null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

/** One flyout at a time. A diagonal toward Stats keeps Artist; Social is instant. */
export function RailFlyoutScope({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const openIdRef = React.useRef<string | null>(null);
  openIdRef.current = openId;
  const settleTimer = React.useRef<number | null>(null);
  const closeTimer = React.useRef<number | null>(null);
  const pendingId = React.useRef<string | null>(null);
  const prevPoint = React.useRef<FlyoutPoint | null>(null);
  const lastPoint = React.useRef<FlyoutPoint | null>(null);
  const panels = React.useRef(new Map<string, HTMLElement>());

  const openFlyoutRect = React.useCallback((): FlyoutRect | null => {
    const id = openIdRef.current;
    if (!id) return null;
    const el = panels.current.get(id);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }, []);

  const isAimingAtOpen = React.useCallback(() => {
    const from = prevPoint.current;
    const to = lastPoint.current;
    const rect = openFlyoutRect();
    if (!from || !to || !rect) return false;
    return isPointerAimingAtFlyout(from, to, rect);
  }, [openFlyoutRect]);

  const commit = React.useCallback((id: string) => {
    clearTimer(settleTimer);
    pendingId.current = null;
    setOpenId(id);
  }, []);

  const waitForAimToClear = React.useCallback(
    (id: string) => {
      pendingId.current = id;
      clearTimer(settleTimer);
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = null;
        if (pendingId.current) commit(pendingId.current);
      }, RAIL_FLYOUT_SETTLE_MS);
    },
    [commit]
  );

  const enter = React.useCallback(
    (id: string, opts?: { immediate?: boolean }) => {
      clearTimer(closeTimer);
      if (openIdRef.current === id) {
        clearTimer(settleTimer);
        pendingId.current = null;
        return;
      }
      if (opts?.immediate || !openIdRef.current || !isAimingAtOpen()) {
        commit(id);
        return;
      }
      waitForAimToClear(id);
    },
    [commit, isAimingAtOpen, waitForAimToClear]
  );

  const leave = React.useCallback(() => {
    clearTimer(settleTimer);
    pendingId.current = null;
    clearTimer(closeTimer);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpenId(null);
    }, RAIL_FLYOUT_CLOSE_MS);
  }, []);

  const dismiss = React.useCallback(() => {
    clearTimer(settleTimer);
    clearTimer(closeTimer);
    pendingId.current = null;
    setOpenId(null);
  }, []);

  const registerPanel = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) panels.current.set(id, el);
    else panels.current.delete(id);
  }, []);

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      prevPoint.current = lastPoint.current;
      lastPoint.current = { x: event.clientX, y: event.clientY };
      const pending = pendingId.current;
      if (!pending) return;
      if (isAimingAtOpen()) {
        waitForAimToClear(pending);
        return;
      }
      commit(pending);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [commit, isAimingAtOpen, waitForAimToClear]);

  React.useEffect(
    () => () => {
      clearTimer(settleTimer);
      clearTimer(closeTimer);
    },
    []
  );

  const api = React.useMemo(
    () => ({ openId, enter, leave, dismiss, registerPanel }),
    [openId, enter, leave, dismiss, registerPanel]
  );
  return <RailFlyoutContext.Provider value={api}>{children}</RailFlyoutContext.Provider>;
}

export function RailNavItem({
  item,
  pathname,
  descriptions,
}: {
  item: RailItem;
  pathname: string;
  descriptions: Record<string, string>;
}) {
  const reduceMotion = useReducedMotion();
  const children = item.children ?? [];
  const hasFlyout = children.length > 0;
  const flyout = React.useContext(RailFlyoutContext);
  const [localOpen, setLocalOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);
  const id = item.href;
  const open = flyout ? flyout.openId === id : localOpen;
  const active = isRailItemActive(pathname, item);
  const Icon = item.icon;

  const registerPanel = React.useCallback(
    (el: HTMLElement | null) => {
      flyout?.registerPanel(id, el);
    },
    [flyout, id]
  );

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openFlyout = React.useCallback(
    (immediate = false) => {
      if (!hasFlyout) return;
      if (flyout) {
        flyout.enter(id, immediate ? { immediate: true } : undefined);
        return;
      }
      cancelClose();
      setLocalOpen(true);
    },
    [cancelClose, flyout, hasFlyout, id]
  );

  const scheduleClose = React.useCallback(() => {
    if (flyout) {
      flyout.leave();
      return;
    }
    cancelClose();
    closeTimer.current = window.setTimeout(() => setLocalOpen(false), RAIL_FLYOUT_CLOSE_MS);
  }, [cancelClose, flyout]);

  const closeNow = React.useCallback(() => {
    if (flyout) {
      flyout.dismiss();
      return;
    }
    cancelClose();
    setLocalOpen(false);
  }, [cancelClose, flyout]);

  React.useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <div
      className="relative"
      onMouseEnter={hasFlyout ? () => openFlyout(false) : undefined}
      onMouseLeave={hasFlyout ? scheduleClose : undefined}
      onFocus={hasFlyout ? () => openFlyout(true) : undefined}
      onBlur={
        hasFlyout
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                scheduleClose();
              }
            }
          : undefined
      }
    >
      <Link
        href={item.href}
        data-context-tour={item.href.slice(1) || "today"}
        title={hasFlyout ? item.label : descriptions[item.href]}
        aria-label={item.label}
        aria-haspopup={hasFlyout ? "menu" : undefined}
        aria-expanded={hasFlyout ? open : undefined}
        className={cn(
          "group relative flex items-center justify-center gap-2.5 rounded-input px-2 py-2.5 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice min-[960px]:justify-start min-[960px]:px-3",
          active
            ? "font-semibold text-text-hi"
            : "font-medium text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
        )}
      >
        {active ? (
          <LfWindow
            className="absolute bottom-1.5 left-[-6px] top-1.5 w-[2px] min-[960px]:left-[-12px]"
            aria-hidden
          />
        ) : null}
        <Icon
          className={cn("size-4 shrink-0", active ? "text-ice" : "text-text-lo")}
          strokeWidth={1.75}
        />
        <span className="hidden min-w-0 flex-1 truncate whitespace-nowrap min-[960px]:inline">{item.label}</span>
        {hasFlyout ? (
          <ChevronRight
            className={cn(
              "hidden size-3 shrink-0 text-text-lo/70 transition-transform duration-200 min-[960px]:block motion-reduce:transition-none",
              open && "translate-x-0.5 text-ice"
            )}
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
        {!hasFlyout ? (
          <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[90] hidden w-60 -translate-y-1/2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs leading-relaxed text-text-lo opacity-0 shadow-e3 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100 min-[960px]:block">
            {descriptions[item.href]}
          </span>
        ) : null}
      </Link>

      <AnimatePresence>
        {hasFlyout && open ? (
          <motion.div
            ref={registerPanel}
            role="menu"
            aria-label={item.label}
            initial={reduceMotion ? false : { opacity: 0, x: -10, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, filter: "blur(4px)" }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-full top-0 z-[90] pl-1.5"
            onMouseEnter={() => openFlyout(true)}
            onMouseLeave={scheduleClose}
          >
            <div className="w-48 overflow-hidden rounded-card border border-line bg-bg-1 py-1 shadow-raise">
            <FlareLine className="mb-1" />
            {children.map((child, index) => {
              const ChildIcon = child.icon;
              const childActive = isRailHrefActive(pathname, child.href);
              return (
                <motion.div
                  key={`${child.href}-${child.label}`}
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.045 * index,
                    duration: reduceMotion ? 0.12 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link
                    href={child.href}
                    role="menuitem"
                    data-context-tour={child.href.slice(1) || "today"}
                    title={descriptions[child.href]}
                    onClick={closeNow}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-hover",
                      childActive
                        ? "bg-bg-2 text-text-hi"
                        : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
                    )}
                  >
                    <ChildIcon
                      className={cn("size-3.5 shrink-0", childActive ? "text-ice" : "text-text-lo")}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  </Link>
                </motion.div>
              );
            })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
