import { useElementHeight } from "@/hooks/use-element-height";
import { Pagination, Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useEffect, useRef, useState } from "react";
import {
  clampPage,
  getPaginatedDataSource,
  sortDataSource,
} from "./utils";

interface IDataTableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey: TableProps<T>["rowKey"];
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  scrollX?: number;
  size?: TableProps<T>["size"];
  fitHeight?: boolean;
  showPagination?: boolean;
  rowClassName?: TableProps<T>["rowClassName"];
  rowSelection?: TableProps<T>["rowSelection"];
  onRow?: TableProps<T>["onRow"];
  onPaginationChange?: (page: number, pageSize: number) => void;
}

export const DataTable = <T extends object>({
  columns,
  dataSource,
  rowKey,
  loading,
  page: controlledPage,
  pageSize: controlledPageSize,
  total = dataSource.length,
  scrollX,
  size,
  fitHeight = true,
  showPagination = true,
  rowClassName,
  rowSelection,
  onRow,
  onPaginationChange,
}: IDataTableProps<T>) => {
  const { elementRef: tableRegionRef, height: tableRegionHeight } =
    useElementHeight();
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(0);
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(10);
  const [sorter, setSorter] = useState<
    SorterResult<T> | SorterResult<T>[]
  >({});
  const requestedPage = controlledPage ?? internalPage;
  const pageSize = controlledPageSize ?? internalPageSize;
  const page = controlledPage
    ? requestedPage
    : clampPage(requestedPage, pageSize, dataSource.length);
  const sortedData = sortDataSource(dataSource, columns, sorter);
  let paginatedData = dataSource;
  if (!onPaginationChange) {
    paginatedData = showPagination
      ? getPaginatedDataSource(sortedData, page, pageSize)
      : sortedData;
  }

  useEffect(() => {
    if (!controlledPage && internalPage !== page) {
      setInternalPage(page);
    }
  }, [controlledPage, internalPage, page]);

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    if (onPaginationChange) {
      onPaginationChange(nextPage, nextPageSize);
      return;
    }

    setInternalPage(nextPage);
    setInternalPageSize(nextPageSize);
  };

  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) return;

    const updateTableHeaderHeight = () => {
      const headerElement = tableElement.querySelector<HTMLElement>(
        ".ant-table-thead",
      );
      setTableHeaderHeight(headerElement?.getBoundingClientRect().height ?? 0);
    };

    updateTableHeaderHeight();

    const resizeObserver = new ResizeObserver(updateTableHeaderHeight);
    const headerElement = tableElement.querySelector<HTMLElement>(
      ".ant-table-thead",
    );
    resizeObserver.observe(headerElement ?? tableElement);
    return () => resizeObserver.disconnect();
  }, [tableRegionHeight]);

  const table = (
    <div ref={tableRef} className={fitHeight ? "h-full" : undefined}>
      <Table
        columns={columns}
        dataSource={paginatedData}
        rowKey={rowKey}
        loading={loading}
        size={size}
        rowClassName={rowClassName}
        rowSelection={rowSelection}
        onRow={onRow}
        onChange={(_, __, nextSorter) => setSorter(nextSorter)}
        scroll={
          fitHeight
            ? {
                x: scrollX,
                y: Math.max(tableRegionHeight - tableHeaderHeight - 1, 120),
              }
            : { x: scrollX }
        }
        pagination={false}
        className={fitHeight ? "h-full" : undefined}
      />
    </div>
  );

  if (!fitHeight && !showPagination) {
    return table;
  }

  return (
    <div
      className={
        fitHeight ? "flex h-full min-h-0 flex-col" : "flex flex-col"
      }
    >
      <div ref={tableRegionRef} className="min-h-0 flex-1">
        {table}
      </div>
      {showPagination && (
        <div className="shrink-0 border-t border-slate-200 px-4 py-3">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(totalCount, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${totalCount} 条`
            }
            onChange={handlePaginationChange}
          />
        </div>
      )}
    </div>
  );
};
