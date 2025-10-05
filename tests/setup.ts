// テスト環境でのコンソール出力を抑制
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
};

// テスト環境でのみコンソール出力を抑制
if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  // ログ抑制フラグを設定
  process.env.SUPPRESS_LOGS = "true";

  // 全てのコンソール出力を抑制（テスト結果のみ表示）
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.debug = () => {};
  console.trace = () => {};
  // エラーも抑制（テスト結果で十分）
  console.error = () => {};
}

// テスト終了後に復元（必要に応じて）
export { originalConsole };
