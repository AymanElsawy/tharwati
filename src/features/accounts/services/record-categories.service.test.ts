import { describe, expect, it } from "vitest"

import {
  buildVisibleRecordCategoryTree,
  searchVisibleRecordCategories,
} from "./record-categories.service"

describe("record category tree", () => {
  it("applies user overrides, hides defaults, and preserves explicit order", () => {
    const categories = [
      { id: "main-2", userId: null, parentId: null, systemCode: "two", level: "main" as const, name: "Two", sortOrder: 2, isArchived: false },
      { id: "main-1", userId: null, parentId: null, systemCode: "one", level: "main" as const, name: "One", sortOrder: 1, isArchived: false },
      { id: "sub-2", userId: null, parentId: "main-1", systemCode: "one.two", level: "subcategory" as const, name: "Second", sortOrder: 2, isArchived: false },
      { id: "sub-1", userId: null, parentId: "main-1", systemCode: "one.one", level: "subcategory" as const, name: "First", sortOrder: 1, isArchived: false },
    ]

    expect(buildVisibleRecordCategoryTree(categories, [
      { categoryId: "main-1", name: "Renamed", isHidden: false },
      { categoryId: "sub-2", name: null, isHidden: true },
    ])).toEqual([
      { id: "main-1", name: "Renamed", sortOrder: 1, subcategories: [{ id: "sub-1", name: "First", sortOrder: 1 }] },
      { id: "main-2", name: "Two", sortOrder: 2, subcategories: [] },
    ])
  })
})

describe("record category search", () => {
  it("matches either hierarchy level while retaining configured order and context", () => {
    const tree = buildVisibleRecordCategoryTree([
      { id: "main-b", userId: null, parentId: null, systemCode: "b", level: "main", name: "Life & Entertainment", sortOrder: 2, isArchived: false },
      { id: "main-a", userId: null, parentId: null, systemCode: "a", level: "main", name: "Food & Drinks", sortOrder: 1, isArchived: false },
      { id: "sub-a", userId: null, parentId: "main-a", systemCode: "a.a", level: "subcategory", name: "Restaurant", sortOrder: 1, isArchived: false },
      { id: "sub-b", userId: null, parentId: "main-b", systemCode: "b.a", level: "subcategory", name: "Gym & Sport", sortOrder: 1, isArchived: false },
    ], [])

    expect(searchVisibleRecordCategories(tree, "life")).toEqual([
      { mainCategoryId: "main-b", mainCategoryName: "Life & Entertainment", subcategoryId: "sub-b", subcategoryName: "Gym & Sport" },
    ])
    expect(searchVisibleRecordCategories(tree, "").map((result) => result.subcategoryId)).toEqual(["sub-a", "sub-b"])
  })
})
