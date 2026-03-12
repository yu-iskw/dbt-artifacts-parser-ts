import { Parser, Select, Column, From } from "node-sql-parser";

export interface ColumnDependency {
  sourceTable: string;
  sourceColumn: string;
}

export type ColumnDependencyMap = Record<string, ColumnDependency[]>;

/**
 * SQLAnalyzer performs AST analysis on SQL to infer column-level lineage.
 */
export class SQLAnalyzer {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Analyze SQL to extract column-level dependencies.
   * @param sql The compiled SQL code.
   * @param dialect The SQL dialect (e.g., 'mysql', 'postgresql', 'snowflake').
   * @returns A map of target column names to their source dependencies.
   */
  public analyze(sql: string, dialect: string = "mysql"): ColumnDependencyMap {
    try {
      const cleanSql = sql.trim().replace(/;+$/, "");
      const ast = this.parser.astify(cleanSql, { database: dialect });

      if (Array.isArray(ast)) {
        const selectAst = ast.find((s) => s.type === "select") as Select;
        return selectAst ? this.analyzeSelect(selectAst, dialect) : {};
      }

      return this.analyzeSelect(ast as Select, dialect);
    } catch (error) {
      return {};
    }
  }

  private analyzeSelect(
    select: Select,
    dialect: string,
    parentCteMap: Record<string, ColumnDependencyMap> = {},
  ): ColumnDependencyMap {
    if (!select || select.type !== "select") return {};

    const dependencies: ColumnDependencyMap = {};
    const tableMap = this.buildTableMap((select.from as any) || []);

    // Handle CTEs - build on top of parent CTEs
    const cteMap: Record<string, ColumnDependencyMap> = { ...parentCteMap };
    if (select.with && Array.isArray(select.with)) {
      for (const cte of select.with) {
        if (cte.stmt && cte.stmt.ast) {
          // Pass current cteMap to support nested CTEs that refer to previous ones
          cteMap[cte.name.value] = this.analyzeSelect(
            cte.stmt.ast as Select,
            dialect,
            cteMap,
          );
        }
      }
    }

    if (!select.columns) return {};

    // Process output columns
    if (Array.isArray(select.columns)) {
      for (const col of select.columns as any[]) {
        let targetName: string | undefined;

        if (col.as) {
          targetName = col.as;
        } else if (
          typeof col.expr === "object" &&
          col.expr.type === "column_ref"
        ) {
          targetName = this.extractColumnName(col.expr.column);
        }

        if (!targetName || targetName === "*") {
          const colColumn =
            col.expr && col.expr.type === "column_ref"
              ? this.extractColumnName(col.expr.column)
              : undefined;
          if (targetName === "*" || colColumn === "*") {
            const starDeps = this.resolveExpressionDependencies(
              col.expr,
              tableMap,
              cteMap,
            );
            dependencies["*"] = this.uniqueDependencies(starDeps);
          }
          continue;
        }

        const colDeps = this.resolveExpressionDependencies(
          col.expr,
          tableMap,
          cteMap,
        );
        const uniqueDeps = this.uniqueDependencies(colDeps);
        if (uniqueDeps.length > 0) {
          dependencies[targetName] = uniqueDeps;
        }
      }
    }

    return dependencies;
  }

  private extractColumnName(column: any): string {
    if (typeof column === "string") return column;
    if (column && typeof column === "object") {
      if (column.expr && column.expr.type === "default") {
        return column.expr.value;
      }
      // Fallback for other complex column structures
    }
    return String(column);
  }

  private buildTableMap(from: any[]): Record<string, string> {
    const map: Record<string, string> = {};
    if (!from || !Array.isArray(from)) return map;

    for (const f of from) {
      if (f.table) {
        const actualTable = f.table;
        const alias = f.as || actualTable;
        map[alias] = actualTable;
      } else if (f.expr && f.expr.ast) {
        const subqueryAlias = f.as;
        if (subqueryAlias) {
          map[subqueryAlias] = `__subquery_${subqueryAlias}__`;
        }
      }
    }
    return map;
  }

  private resolveExpressionDependencies(
    expr: any,
    tableMap: Record<string, string>,
    cteMap: Record<string, ColumnDependencyMap>,
  ): ColumnDependency[] {
    const deps: ColumnDependency[] = [];

    const traverse = (node: any) => {
      if (!node || typeof node !== "object") return;

      if (node.type === "column_ref") {
        const tableAlias = node.table;
        const columnName = this.extractColumnName(node.column);

        if (tableAlias) {
          const actualTable = tableMap[tableAlias];
          if (actualTable) {
            if (cteMap[actualTable]) {
              const cteDeps = cteMap[actualTable][columnName] || [];
              if (cteDeps.length > 0) {
                deps.push(...cteDeps);
              } else {
                // Fallback: if CTE exists but column not found (maybe SELECT *),
                // at least point to the CTE
                deps.push({
                  sourceTable: actualTable,
                  sourceColumn: columnName,
                });
              }
            } else {
              deps.push({ sourceTable: actualTable, sourceColumn: columnName });
            }
          }
        } else {
          const tables = Object.values(tableMap);
          if (tables.length === 1) {
            const actualTable = tables[0];
            if (cteMap[actualTable]) {
              const cteDeps = cteMap[actualTable][columnName] || [];
              if (cteDeps.length > 0) {
                deps.push(...cteDeps);
              } else {
                deps.push({
                  sourceTable: actualTable,
                  sourceColumn: columnName,
                });
              }
            } else {
              deps.push({ sourceTable: actualTable, sourceColumn: columnName });
            }
          } else {
            for (const table of tables) {
              if (cteMap[table] && cteMap[table][columnName]) {
                deps.push(...cteMap[table][columnName]);
              }
            }
          }
        }
      } else if (node.type === "binary_expr") {
        traverse(node.left);
        traverse(node.right);
      } else if (node.type === "function") {
        if (node.args && Array.isArray(node.args.value)) {
          node.args.value.forEach(traverse);
        }
      } else if (node.type === "aggr_func") {
        if (node.args && node.args.expr) {
          traverse(node.args.expr);
        }
      } else if (node.type === "case") {
        if (node.args) {
          node.args.forEach((arg: any) => {
            traverse(arg.cond);
            traverse(arg.result);
          });
        }
        traverse(node.fallback);
      } else if (node.type === "cast") {
        traverse(node.expr);
      }
    };

    traverse(expr);
    return deps;
  }

  private uniqueDependencies(deps: ColumnDependency[]): ColumnDependency[] {
    const seen = new Set<string>();
    return deps.filter((d) => {
      const key = `${d.sourceTable}.${d.sourceColumn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
