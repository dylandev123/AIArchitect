"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: ReactNode;
  onEscape?: () => void;
}

// Renders children into document.body so z-index wins over the R3F WebGL
// compositing layer, which paints above position:fixed in the same stacking context.
export function ModalPortal({ children, onEscape }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape?.();
    };
    window.addEventListener("keydown", escHandler);

    // Async setState avoids the react-hooks/set-state-in-effect rule
    // (synchronous setState in an effect body triggers cascading renders).
    const t = setTimeout(() => setMounted(true), 0);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", escHandler);
    };
  }, [onEscape]);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
