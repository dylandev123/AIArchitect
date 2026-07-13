"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { AdminGate } from "./AdminGate";
import { AssetCurator } from "./AssetCurator";

interface AdminButtonProps {
  projectId?: string;
}

export function AdminButton({ projectId }: AdminButtonProps) {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [gateOpen, setGateOpen] = useState(false);
  const [curatorOpen, setCuratorOpen] = useState(false);

  const handleClick = () => {
    if (isAdmin) {
      setCuratorOpen(true);
    } else {
      setGateOpen(true);
    }
  };

  const handleGateSuccess = () => {
    setGateOpen(false);
    setCuratorOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Admin Panel"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          isAdmin
            ? "text-amber-400 hover:bg-amber-500/15"
            : "text-neutral-500 hover:bg-white/8 hover:text-neutral-300"
        }`}
      >
        <Shield size={15} />
      </button>

      {gateOpen && (
        <AdminGate
          onClose={() => setGateOpen(false)}
          onSuccess={handleGateSuccess}
        />
      )}
      {curatorOpen && (
        <AssetCurator
          onClose={() => setCuratorOpen(false)}
          projectId={projectId}
        />
      )}
    </>
  );
}
