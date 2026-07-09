"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface Props {
  text: string;
  size?: number;
}

export function InfoTooltip({ text, size = 13 }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 80 ? "bottom" : "top");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={text}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex cursor-help text-text-muted/60 transition-colors hover:text-text-muted"
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute left-1/2 z-50 w-max max-w-[200px] -translate-x-1/2 rounded-md bg-text px-2.5 py-1.5 text-[11px] leading-tight text-bg-card shadow-lg ${
            position === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              position === "top"
                ? "top-full border-t-text"
                : "bottom-full border-b-text"
            }`}
          />
        </span>
      )}
    </span>
  );
}
