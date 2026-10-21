"use client";

import { JOB_CATEGORIES, getCategory, getSubcategory, type TaxonomySelection } from "@/lib/jobs/categories";

export function CategoryNav({
  selection,
  onChange,
}: {
  selection: TaxonomySelection;
  onChange: (next: TaxonomySelection) => void;
}) {
  const category = getCategory(selection.categoryId);
  const subcategory = getSubcategory(selection.subcategoryId);

  return (
    <div className="mt-4">
      <div role="tablist" aria-label="Skill categories" className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          role="tab"
          aria-selected={!selection.categoryId}
          className={chipClass(!selection.categoryId)}
          onClick={() => onChange({ categoryId: null, subcategoryId: null })}
        >
          All skills
        </button>
        {JOB_CATEGORIES.map((item) => {
          const selected = selection.categoryId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={chipClass(selected)}
              onClick={() =>
                onChange(
                  selected
                    ? { categoryId: null, subcategoryId: null }
                    : { categoryId: item.id, subcategoryId: null },
                )
              }
            >
              {item.name}
            </button>
          );
        })}
      </div>
      {category ? (
        <div role="tablist" aria-label={`${category.name} subcategories`} className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {category.subcategories.map((item) => {
            const selected = selection.subcategoryId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                title={item.description}
                className={chipClass(selected)}
                onClick={() =>
                  onChange({
                    categoryId: category.id,
                    subcategoryId: selected ? null : item.id,
                  })
                }
              >
                {item.name}
              </button>
            );
          })}
        </div>
      ) : null}
      {subcategory ? <p className="mt-2 text-sm text-slate-600">{subcategory.subcategory.description}</p> : null}
    </div>
  );
}

function chipClass(selected: boolean) {
  return `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    selected ? "border-[#C85A17] bg-[#C85A17] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
  }`;
}
