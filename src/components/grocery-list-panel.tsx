"use client";

import { useMemo, useState } from "react";
import type { GroceryListItem, GroceryListSection } from "@/lib/types";

export function GroceryListPanel({
  meal,
  heading = "Grocery List",
}: {
  meal: {
    title: string;
    groceryList: GroceryListSection[];
  };
  heading?: string;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const exportText = useMemo(() => {
    const lines = [
      `${meal.title} Grocery List`,
      "",
      ...meal.groceryList.flatMap((section) => [
        section.title,
        ...section.items.map((item) => `- ${item.quantity} ${item.label}`.trim()),
        "",
      ]),
    ];

    return lines.join("\n").trim();
  }, [meal]);

  function toggleItem(item: GroceryListItem) {
    setCheckedItems((current) => ({
      ...current,
      [item.id]: !current[item.id],
    }));
  }

  async function shareList() {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `${meal.title} Grocery List`,
        text: exportText,
      });
      return;
    }

    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${meal.title.toLowerCase().replace(/\s+/g, "-")}-grocery-list.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyList() {
    await navigator.clipboard.writeText(exportText);
  }

  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-[var(--primary)]">
            Accepted Meal
          </p>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
            type="button"
            onClick={() => void copyList()}
          >
            Copy
          </button>
          <button
            className="rounded-[8px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            type="button"
            onClick={() => void shareList()}
          >
            Export
          </button>
        </div>
      </div>
      <div className="space-y-5 p-5">
        {meal.groceryList.map((section) => (
          <div key={section.id}>
            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.items.map((item) => {
                const checked = Boolean(checkedItems[item.id]);

                return (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-[8px] border border-[var(--border)] bg-white/80 px-3 py-3"
                  >
                    <input
                      checked={checked}
                      className="mt-1 size-4 accent-[var(--primary)]"
                      type="checkbox"
                      onChange={() => toggleItem(item)}
                    />
                    <span>
                      <span
                        className={`block text-sm font-medium ${
                          checked ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {item.quantity}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
