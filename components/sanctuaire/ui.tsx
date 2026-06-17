"use client"

import type { ReactNode } from "react"
import { RGB } from "@/lib/remanence/content"
import type { HueName } from "@/lib/remanence/types"

// Soft amber/rose/cold tokens reused across the Sanctuaire panels.
export function hueText(hue: HueName, a = 0.85) {
  return `rgba(${RGB[hue]}, ${a})`
}

export function Panel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[rgba(2,3,8,0.86)] backdrop-blur-md">
      <header
        className="flex items-start justify-between px-6 pt-7"
        style={{ paddingTop: "calc(1.75rem + env(safe-area-inset-top))" }}
      >
        <div>
          <h2 className="text-xl font-extralight tracking-[0.3em] text-[rgba(232,240,255,0.92)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs font-light italic tracking-wide text-[rgba(210,232,255,0.4)]">
              {subtitle}
            </p>
          )}
        </div>
        <button
          aria-label="Fermer"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full border border-[rgba(210,232,255,0.16)] text-[rgba(210,232,255,0.7)] transition-colors hover:border-[rgba(210,232,255,0.4)] hover:text-[rgba(232,240,255,0.95)]"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div
        className="flex-1 overflow-y-auto px-5 py-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  )
}

// Small Éclats coin glyph + amount.
export function EclatTag({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-block size-2.5 rounded-full bg-[rgba(255,178,92,0.9)] shadow-[0_0_8px_rgba(255,178,92,0.7)]" />
      <span className="font-mono text-sm text-[rgba(255,200,140,0.9)]">{amount}</span>
    </span>
  )
}

export function SouvenirTag({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rotate-45 bg-[rgba(210,232,255,0.85)] shadow-[0_0_8px_rgba(210,232,255,0.6)]" />
      <span className="font-mono text-sm text-[rgba(210,232,255,0.85)]">{amount}</span>
    </span>
  )
}
