"use client";

import { CurriculumSwitcher } from "@/components/curriculum/CurriculumSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Curriculum + theme live in menus now, not in the crowded top bar. */
export function MenuSettings() {
  return (
    <div className="mm-menu-settings">
      <CurriculumSwitcher />
      <ThemeToggle />
    </div>
  );
}
