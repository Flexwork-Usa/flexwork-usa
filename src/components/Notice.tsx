"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/context/AppContext";

export function Notice() {
  const { notice } = useApp();

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={notice}
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="fixed right-4 bottom-6 left-4 z-[60] mx-auto max-w-md rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm"
        >
          {notice}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
