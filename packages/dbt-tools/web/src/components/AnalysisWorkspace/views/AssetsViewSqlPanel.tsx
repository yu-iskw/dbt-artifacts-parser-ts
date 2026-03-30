// ---------------------------------------------------------------------------
// SQL syntax highlighting — zero-dependency tokenizer
// ---------------------------------------------------------------------------
const SQL_KEYWORDS = new Set(
  "SELECT FROM WHERE WITH AS JOIN ON GROUP BY ORDER LIMIT HAVING UNION CASE WHEN THEN ELSE END LEFT RIGHT INNER OUTER CROSS DISTINCT NULL AND OR NOT IN IS BETWEEN LIKE EXISTS INSERT INTO UPDATE SET DELETE CREATE TABLE VIEW REPLACE IF ASC DESC USING AT ZONE INTERVAL QUALIFY WINDOW ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW PARTITION OVER".split(
    " ",
  ),
);
const SQL_FUNCTIONS = new Set(
  "SUM COUNT AVG MAX MIN COALESCE CAST IFF IF ROW_NUMBER RANK DENSE_RANK NTILE LEAD LAG FIRST_VALUE LAST_VALUE NVL NVL2 NULLIF GREATEST LEAST TRIM LTRIM RTRIM UPPER LOWER LENGTH SUBSTR SUBSTRING REPLACE SPLIT CONCAT DATE YEAR MONTH DAY HOUR MINUTE SECOND DATEDIFF DATEADD CURRENT_DATE CURRENT_TIMESTAMP TO_DATE TO_TIMESTAMP TO_NUMBER TO_VARCHAR TRY_CAST CONVERT FLOOR CEIL ROUND ABS MOD SQRT LOG EXP ARRAY_AGG LISTAGG STRING_AGG GROUP_CONCAT FLATTEN UNNEST GENERATE_SERIES".split(
    " ",
  ),
);

interface SqlToken {
  type: string;
  value: string;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- SQL lexer branches
function tokenizeSQL(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let pos = 0;
  const len = sql.length;

  while (pos < len) {
    // Block comment
    if (sql.startsWith("/*", pos)) {
      const end = sql.indexOf("*/", pos + 2);
      const value = end === -1 ? sql.slice(pos) : sql.slice(pos, end + 2);
      tokens.push({ type: "comment", value });
      pos += value.length;
      continue;
    }
    // Line comment
    if (sql.startsWith("--", pos)) {
      const end = sql.indexOf("\n", pos);
      const value = end === -1 ? sql.slice(pos) : sql.slice(pos, end + 1);
      tokens.push({ type: "comment", value });
      pos += value.length;
      continue;
    }
    // Single-quoted string
    if (sql[pos] === "'") {
      let i = pos + 1;
      while (i < len) {
        if (sql[i] === "'" && sql[i - 1] !== "\\") {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: "string", value: sql.slice(pos, i) });
      pos = i;
      continue;
    }
    // Number
    const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(sql.slice(pos));
    if (numMatch && (pos === 0 || !/[a-zA-Z_]/.test(sql[pos - 1]))) {
      tokens.push({ type: "number", value: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }
    // Word (keyword, function, or identifier)
    const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(sql.slice(pos));
    if (wordMatch) {
      const word = wordMatch[0];
      const upper = word.toUpperCase();
      const type = SQL_KEYWORDS.has(upper)
        ? "keyword"
        : SQL_FUNCTIONS.has(upper)
          ? "function"
          : "identifier";
      tokens.push({ type, value: word });
      pos += word.length;
      continue;
    }
    // Operator
    if (/[=<>!|+\-*/%^&~]/.test(sql[pos])) {
      tokens.push({ type: "operator", value: sql[pos] });
      pos++;
      continue;
    }
    // Punctuation
    if (/[(),;.[\]{}]/.test(sql[pos])) {
      tokens.push({ type: "punctuation", value: sql[pos] });
      pos++;
      continue;
    }
    // Whitespace / anything else — keep as-is
    tokens.push({ type: "plain", value: sql[pos] });
    pos++;
  }
  return tokens;
}

export function SqlPanel({ sql }: { sql: string }) {
  const tokens = tokenizeSQL(sql);
  return (
    <pre className="sql-panel">
      <code>
        {tokens.map((token, i) =>
          token.type === "plain" || token.type === "identifier" ? (
            token.value
          ) : (
            <span key={i} className={`sql-token-${token.type}`}>
              {token.value}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
