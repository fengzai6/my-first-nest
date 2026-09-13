import type { ColumnsType } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";

export const clampPage = (
  page: number,
  pageSize: number,
  total: number,
): number => {
  const maxPage = Math.max(Math.ceil(total / pageSize), 1);
  return Math.min(page, maxPage);
};

export const sortDataSource = <T extends object>(
  dataSource: T[],
  columns: ColumnsType<T>,
  sorter: SorterResult<T> | SorterResult<T>[],
): T[] => {
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  const column =
    activeSorter?.column ??
    columns.find((item) => item.key === activeSorter?.columnKey);

  if (!column?.sorter || !activeSorter.order) {
    return dataSource;
  }

  const compare = (
    column.sorter as (
      a: T,
      b: T,
      sortOrder?: typeof activeSorter.order,
    ) => number
  );
  return [...dataSource].sort(
    (a, b) =>
      compare(a, b, activeSorter.order) *
      (activeSorter.order === "ascend" ? 1 : -1),
  );
};

export const getPaginatedDataSource = <T>(
  dataSource: T[],
  page: number,
  pageSize: number,
): T[] => dataSource.slice((page - 1) * pageSize, page * pageSize);
