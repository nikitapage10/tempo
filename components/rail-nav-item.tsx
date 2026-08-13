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
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);
  const active = isRailItemActive(pathname, item);
  const Icon = item.icon;

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openFlyout = React.useCallback(() => {
    if (!hasFlyout) return;
    cancelClose();
    setOpen(true);
  }, [cancelClose, hasFlyout]);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }, [cancelClose]);

  React.useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <div
      className="relative"
      onMouseEnter={openFlyout}
      onMouseLeave={scheduleClose}
      onFocus={openFlyout}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
      <Link
        href={item.href}
        data-context-tour={item.href.slice(1) || "today"}
        title={hasFlyout ? item.label : descriptions[item.href]}
        aria-label={item.label}
        aria-haspopup={hasFlyout ? "menu" : undefined}
        aria-expanded={hasFlyout ? open : undefined}
        className={cn(
          "group relative flex items-center justify-center gap-2.5 rounded-input px-2 py-2 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice xl:justify-start xl:px-3",
          active
            ? "font-semibold text-text-hi"
            : "font-medium text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
        )}
      >
        {active ? (
          <LfWindow
            className="absolute left-[-6px] top-1.5 bottom-1.5 w-[2px] xl:left-[-12px]"
            aria-hidden
          />
        ) : null}
        <Icon
          className={cn("size-4 shrink-0", active ? "text-ice" : "text-text-lo")}
          strokeWidth={1.75}
        />
        <span className="hidden min-w-0 flex-1 truncate xl:inline">{item.label}</span>
        {hasFlyout ? (
          <ChevronRight
            className={cn(
              "hidden size-3 shrink-0 text-text-lo/70 transition-transform duration-200 xl:block motion-reduce:transition-none",
              open && "translate-x-0.5 text-ice"
            )}
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
        {!hasFlyout ? (
          <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[90] hidden w-60 -translate-y-1/2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs leading-relaxed text-text-lo opacity-0 shadow-e3 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100 xl:block">
            {descriptions[item.href]}
          </span>
        ) : null}
      </Link>

      <AnimatePresence>
        {hasFlyout && open ? (
          <motion.div
            role="menu"
            aria-label={item.label}
            initial={reduceMotion ? false : { opacity: 0, x: -10, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, filter: "blur(4px)" }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-full top-0 z-[90] pl-1.5"
            onMouseEnter={openFlyout}
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
                    onClick={() => setOpen(false)}
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
