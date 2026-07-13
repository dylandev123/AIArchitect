"use client";

import { create } from "zustand";

interface AdminStore {
  isAdmin: boolean;
  adminEmail: string;
  setAdmin: (email: string) => void;
  clearAdmin: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAdmin: false,
  adminEmail: "",
  setAdmin: (email) => set({ isAdmin: true, adminEmail: email }),
  clearAdmin: () => set({ isAdmin: false, adminEmail: "" }),
}));
