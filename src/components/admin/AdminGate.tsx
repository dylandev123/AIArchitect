"use client";

import { useState } from "react";
import { Shield, X } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { ModalPortal } from "./ModalPortal";

interface AdminGateProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminGate({ onClose, onSuccess }: AdminGateProps) {
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { admin?: boolean };
      if (data.admin) {
        setAdmin(email);
        onSuccess?.();
      } else {
        setError("Access denied. This email is not an admin.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onEscape={onClose}>
      {/* Full-screen backdrop — blocks all canvas interaction */}
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 9999 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Dialog — pointer events explicitly enabled since body may have them locked */}
        <div
          className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 shadow-2xl"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/8 hover:text-neutral-300 transition"
          >
            <X size={14} />
          </button>

          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Shield size={24} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-neutral-100">Admin Access</p>
              <p className="mt-1 text-xs text-neutral-500">Asset Curator is restricted to admins</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your admin email"
              required
              className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-amber-500/50 transition"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Checking…" : "Verify Access"}
            </button>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
