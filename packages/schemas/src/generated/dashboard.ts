/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `Dashboard`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `Dashboard`'s JSON-Schema
 * via the `definition` "date".
 */
export type Date = string;
/**
 * This interface was referenced by `Dashboard`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

export interface Dashboard {
  schemaVersion: "1.0.0";
  id: Uuid;
  name: string;
  filters: Filters;
  /**
   * @minItems 1
   * @maxItems 50
   */
  widgets: [Widget, ...Widget[]];
  createdAt: DateTime;
  updatedAt: DateTime;
}
/**
 * This interface was referenced by `Dashboard`'s JSON-Schema
 * via the `definition` "filters".
 */
export interface Filters {
  dateFrom?: Date;
  dateTo?: Date;
  accountIds?: Uuid[];
  categoryIds?: Uuid[];
  merchantIds?: Uuid[];
  tags?: string[];
  currency?: string;
  excludeTransfers?: boolean;
}
/**
 * This interface was referenced by `Dashboard`'s JSON-Schema
 * via the `definition` "widget".
 */
export interface Widget {
  id: Uuid;
  type:
    | "metric"
    | "timeSeries"
    | "categoryBreakdown"
    | "merchantRanking"
    | "moneyFlow"
    | "calendarHeatmap"
    | "recurringList"
    | "table";
  title: string;
  query: {
    metric: "income" | "spending" | "netCashFlow" | "transactionCount" | "savingsRate";
    dimension?: "month" | "category" | "merchant" | "account" | "day";
    limit?: number;
    sort?: "valueAsc" | "valueDesc" | "labelAsc" | "labelDesc" | "dateAsc" | "dateDesc";
  };
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  showTableAlternative: true;
}
