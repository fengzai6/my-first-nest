import type { ColumnsType } from "antd/es/table";
import { describe, expect, it } from "vitest";

import {
  clampPage,
  getPaginatedDataSource,
  sortDataSource,
} from "./utils";

interface IRow {
  id: number;
  name: string;
}

const columns: ColumnsType<IRow> = [
  {
    title: "名称",
    dataIndex: "name",
    key: "name",
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
];

describe("data table utilities", () => {
  it("clamps an uncontrolled page after the data source shrinks", () => {
    expect(clampPage(3, 10, 12)).toBe(2);
    expect(clampPage(3, 10, 0)).toBe(1);
  });

  it("sorts the full data source before pagination", () => {
    const data = [
      { id: 1, name: "charlie" },
      { id: 2, name: "alpha" },
      { id: 3, name: "bravo" },
    ];
    const sorted = sortDataSource(data, columns, {
      columnKey: "name",
      order: "ascend",
    });

    expect(getPaginatedDataSource(sorted, 2, 2)).toEqual([
      { id: 1, name: "charlie" },
    ]);
  });

  it("keeps the complete sorted data source when pagination is disabled", () => {
    const data = [
      { id: 1, name: "charlie" },
      { id: 2, name: "alpha" },
      { id: 3, name: "bravo" },
    ];

    expect(
      sortDataSource(data, columns, {
        columnKey: "name",
        order: "ascend",
      }),
    ).toEqual([
      { id: 2, name: "alpha" },
      { id: 3, name: "bravo" },
      { id: 1, name: "charlie" },
    ]);
  });
});
