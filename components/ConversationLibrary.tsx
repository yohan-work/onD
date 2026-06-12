"use client";

import { useEffect, useRef, useState } from "react";

import type { Conversation } from "@/lib/types";

type ConversationLibraryProps = {
  conversations: Conversation[];
  activeId: string | null;
  query: string;
  disabled: boolean;
  onQueryChange: (query: string) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  onToggleFavorite: (conversation: Conversation) => void;
  onExport: (conversation: Conversation, format: "json" | "markdown") => void;
  onCreateBenchmark: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
};

type MenuPosition = {
  top: number;
  right: number;
};

const MENU_HEIGHT = 148;

export function ConversationLibrary({
  conversations,
  activeId,
  query,
  disabled,
  onQueryChange,
  onNew,
  onSelect,
  onRename,
  onToggleFavorite,
  onExport,
  onCreateBenchmark,
  onDelete,
}: ConversationLibraryProps) {
  const [menuConversationId, setMenuConversationId] = useState<string | null>(
    null,
  );
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuConversation =
    conversations.find(
      (conversation) => conversation.id === menuConversationId,
    ) ?? null;

  useEffect(() => {
    if (!menuConversationId) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setMenuConversationId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuConversationId(null);
      }
    };
    const handleViewportChange = () => setMenuConversationId(null);

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [menuConversationId]);

  const closeAndRun = (action: () => void) => {
    setMenuConversationId(null);
    action();
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-secondary)]">
          Conversations
        </h2>
        <button
          type="button"
          disabled={disabled}
          onClick={onNew}
          className="rounded bg-[var(--ink)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--accent)] disabled:opacity-40"
        >
          New
        </button>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search local conversations"
        className="h-9 w-full rounded-md border border-[var(--line)] bg-white px-2.5 text-[10px] outline-none focus:border-[var(--accent)]"
      />
      <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
        {conversations.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--line)] px-2.5 py-3 text-center text-[11px] text-[var(--ink-muted)]">
            No saved conversations
          </p>
        ) : (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeId;
            const isMenuOpen = conversation.id === menuConversationId;

            return (
              <div
                key={conversation.id}
                className={`group relative flex min-h-8 items-center rounded-lg border transition ${
                  isActive
                    ? "border-[var(--line)] bg-white shadow-sm"
                    : "border-transparent hover:bg-white/65"
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(conversation.id)}
                  className="min-w-0 flex-1 truncate py-2 pr-1.5 pl-2.5 text-left text-[11px] font-medium tracking-[-0.01em] text-[var(--ink)] disabled:cursor-not-allowed"
                >
                  {conversation.title}
                </button>

                <div
                  className={`mr-1.5 flex shrink-0 items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
                    isMenuOpen ? "md:opacity-100" : ""
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={
                      conversation.favorite
                        ? `Unstar ${conversation.title}`
                        : `Star ${conversation.title}`
                    }
                    title={
                      conversation.favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    onClick={() => onToggleFavorite(conversation)}
                    className={`grid h-6 w-6 place-items-center rounded-md transition hover:bg-[var(--panel-muted)] ${
                      conversation.favorite
                        ? "text-[var(--accent)]"
                        : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <StarIcon filled={conversation.favorite} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`More options for ${conversation.title}`}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    onClick={(event) => {
                      if (isMenuOpen) {
                        setMenuConversationId(null);
                        return;
                      }

                      const rect = event.currentTarget.getBoundingClientRect();
                      const openAbove =
                        rect.bottom + MENU_HEIGHT > window.innerHeight - 12;
                      setMenuPosition({
                        top: openAbove
                          ? Math.max(12, rect.top - MENU_HEIGHT - 6)
                          : rect.bottom + 6,
                        right: Math.max(12, window.innerWidth - rect.right),
                      });
                      setMenuConversationId(conversation.id);
                    }}
                    className={`grid h-6 w-6 place-items-center rounded-md text-[var(--ink-muted)] transition hover:bg-[var(--panel-muted)] hover:text-[var(--ink)] ${
                      isMenuOpen ? "bg-[var(--panel-muted)] text-[var(--ink)]" : ""
                    }`}
                  >
                    <MoreIcon />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {menuConversation && menuPosition ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${menuConversation.title}`}
          style={{
            position: "fixed",
            top: menuPosition.top,
            right: menuPosition.right,
          }}
          className="z-50 min-w-[10.5rem] w-max rounded-lg border border-[var(--line)] bg-white p-1 shadow-[0_18px_48px_rgba(23,24,21,0.16)]"
        >
          <MenuAction
            label="Rename"
            icon={<RenameIcon />}
            onClick={() =>
              closeAndRun(() => onRename(menuConversation))
            }
          />
          <MenuAction
            label="Export Markdown"
            icon={<MarkdownIcon />}
            onClick={() =>
              closeAndRun(() => onExport(menuConversation, "markdown"))
            }
          />
          <MenuAction
            label="Export JSON"
            icon={<JsonIcon />}
            compact
            onClick={() =>
              closeAndRun(() => onExport(menuConversation, "json"))
            }
          />
          <MenuAction
            label="Create benchmark"
            icon={<BenchmarkIcon />}
            compact
            onClick={() =>
              closeAndRun(() => onCreateBenchmark(menuConversation))
            }
          />
          <div className="my-1 border-t border-[var(--line)]" />
          <MenuAction
            label="Delete"
            icon={<DeleteIcon />}
            danger
            compact
            onClick={() =>
              closeAndRun(() => onDelete(menuConversation))
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function MenuAction({
  label,
  icon,
  danger = false,
  compact = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium leading-none whitespace-nowrap transition ${
        compact ? "text-[9px]" : "text-[10px]"
      } ${
        danger
          ? "text-[var(--error)] hover:bg-[var(--error-soft)]"
          : "text-[var(--ink-secondary)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink)]"
      }`}
    >
      <span
        className={`grid shrink-0 place-items-center ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M6 15V9l3 3 3-3v6M16 9v6m-2-2 2 2 2-2" />
    </svg>
  );
}

function JsonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 3c-2 0-3 1-3 3v3c0 1-.5 2-2 2 1.5 0 2 1 2 2v3c0 2 1 3 3 3M16 3c2 0 3 1 3 3v3c0 1 .5 2 2 2-1.5 0-2 1-2 2v3c0 2-1 3-3 3" />
    </svg>
  );
}

function BenchmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}
