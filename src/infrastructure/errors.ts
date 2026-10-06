/** Whitelisted error codes. Only the code (never question text or notes) may be logged or exported. */
export type AppErrorCode =
  | 'INVALID_COUNTS' | 'INVALID_FIGURE' | 'INVALID_MOTHERS' | 'INVALID_SOURCE' | 'INVALID_QUESTION'
  | 'INVALID_NOTES' | 'INVALID_OUTCOME' | 'INVALID_PLAN' | 'INVALID_STATE'
  | 'RNG_UNAVAILABLE'
  | 'STORAGE_UNAVAILABLE' | 'QUOTA'
  | 'REVISION_CONFLICT' | 'NOT_FOUND' | 'DRAFT_EXISTS'
  | 'INTEGRITY_MISMATCH' | 'UNSUPPORTED_VERSION' | 'IMPORT_TOO_LARGE' | 'IMPORT_INVALID';

export class AppError extends Error {
  code: AppErrorCode;
  constructor(code: AppErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

const DOMAIN_CODES: readonly string[] = ['INVALID_COUNTS', 'INVALID_FIGURE', 'INVALID_MOTHERS', 'INVALID_SOURCE',
  'INVALID_QUESTION', 'RNG_UNAVAILABLE'];

/** Normalises anything thrown by the domain, IndexedDB or the browser into an AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const name = (error as { name?: string } | null)?.name;
  const message = (error as { message?: string } | null)?.message ?? '';
  if (name === 'QuotaExceededError') return new AppError('QUOTA');
  if (message === 'INVALID_RANDOM_BYTES' || message === 'INVALID_DOTS') return new AppError('INVALID_SOURCE');
  if (DOMAIN_CODES.includes(message)) return new AppError(message as AppErrorCode);
  return new AppError('STORAGE_UNAVAILABLE');
}

export const ERROR_TEXT: Record<AppErrorCode, string> = {
  INVALID_COUNTS: '輸入格式不完整，請檢查列數。',
  INVALID_FIGURE: '輸入格式不完整，請檢查四母象。',
  INVALID_MOTHERS: '輸入格式不完整，請檢查四母象。',
  INVALID_SOURCE: '起卦來源格式不正確。',
  INVALID_QUESTION: '問題或主題宮位不完整，請回到新增占問檢查。',
  INVALID_NOTES: '筆記超過 5000 字的上限。',
  INVALID_OUTCOME: '事後回顧需要選擇一個結果，文字不能超過 2000 字。',
  INVALID_PLAN: '請寫下打算做的事或選一個回顧日期；文字不能超過 1000 字。',
  INVALID_STATE: '這個步驟目前無法執行，請重新載入頁面。',
  RNG_UNAVAILABLE: '目前無法使用裝置亂數。請改用十六列點沙或手動輸入。',
  STORAGE_UNAVAILABLE: '尚未保存。請重試，或先匯出備份。',
  QUOTA: '瀏覽器儲存空間不足，尚未保存。請重試，或先匯出備份。',
  REVISION_CONFLICT: '另一個分頁已更新這筆資料。',
  NOT_FOUND: '這個瀏覽器找不到這筆記錄。',
  DRAFT_EXISTS: '已有一筆尚未完成的占問。',
  INTEGRITY_MISMATCH: '盤面與原始資料不一致。',
  UNSUPPORTED_VERSION: '此版本只能封存檢視。',
  IMPORT_TOO_LARGE: '檔案超過本版容量限制（10 MiB／100 筆），請分割備份。',
  IMPORT_INVALID: '這不是地占沙盤的備份檔，或檔案內容已損壞。',
};
