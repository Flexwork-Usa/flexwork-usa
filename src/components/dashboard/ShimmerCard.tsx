"use client";

import { motion } from "framer-motion";

export function ShimmerCard({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <motion.div
        className="h-4 w-1/3 rounded bg-slate-200"
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="mt-4 h-3 w-full rounded bg-slate-100"
        animate={{ opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
      />
      <motion.div
        className="mt-2 h-3 w-5/6 rounded bg-slate-100"
        animate={{ opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="mt-6 h-9 w-28 rounded-lg bg-slate-200"
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ShimmerCard />
        <ShimmerCard />
        <ShimmerCard className="md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
}
