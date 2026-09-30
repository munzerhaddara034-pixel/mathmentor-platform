"use client";

import { CurriculumSwitcher } from "@/components/curriculum/CurriculumSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";

/** Language + curriculum + theme inside menus (the top bar also has compact language/theme buttons). */
export function MenuSettings() {
  return (
    <div className="mm-menu-settings">
      <LocaleSwitcher variant="inline" />
      <CurriculumSwitcher />
      <ThemeToggle />
    </div>
  );
}
