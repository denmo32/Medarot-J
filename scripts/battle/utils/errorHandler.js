/**
 * @file エラーハンドリングユーティリティ
 * ゲーム全体でのエラー処理を統一するためのモジュール
 */

/**
 * エラータイプの定義
 * @enum {string}
 */
export const ErrorType = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',      // 入力値やデータの検証エラー
    CALCULATION_ERROR: 'CALCULATION_ERROR',    // 計算時のエラー
    SYSTEM_ERROR: 'SYSTEM_ERROR',              // システム内部のエラー
    COMPONENT_ERROR: 'COMPONENT_ERROR',        // コンポーネント関連のエラー
    ACTION_ERROR: 'ACTION_ERROR',              // アクション実行時のエラー
    NETWORK_ERROR: 'NETWORK_ERROR',            // ネットワークリクエスト時のエラー (将来的に使用)
};

/**
 * ゲーム用カスタムエラークラス
 * @class GameError
 * @extends Error
 */
export class GameError extends Error {
    /**
     * @param {string} message エラーメッセージ
     * @param {ErrorType} type エラーのカテゴリ
     * @param {Object} [details] 追加の詳細情報
     * @param {number} [entityId] 関連するエンティティID (任意)
     */
    constructor(message, type, details = {}, entityId = null) {
        super(message);
        this.name = 'GameError';
        this.type = type;
        this.details = details;
        this.entityId = entityId;
        this.timestamp = new Date().toISOString();
        
        // スタックトレースを保持
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * エラーハンドラ
 * ゲーム全体のエラー処理を管理するクラス
 */
export class ErrorHandler {
    /**
     * エラーログを記録するための設定
     * @type {Object}
     */
    static config = {
        // エラーをコンソールに出力するか
        logToConsole: true,
        // エラーを記録するか
        logToFile: false, // 将来的にサーバー等で実装する場合
        // 重大度に基づく処理設定
        severityThreshold: 'error', // 'debug', 'info', 'warning', 'error'
    };

    /**
     * エラーを処理する
     * @param {Error|GameError} error 処理するエラー
     * @param {Object} [context] エラー発生時のコンテキスト情報
     */
    static handle(error, context = {}) {
        // 通常のErrorオブジェクトをGameErrorに変換
        if (!(error instanceof GameError)) {
            error = new GameError(
                error.message || 'Unknown error occurred',
                ErrorType.SYSTEM_ERROR,
                { originalError: error, context },
                context.entityId || null
            );
        }

        // エラー情報をログに出力
        this.logError(error);

        // エラーの重大度に応じた処理
        this.handleBySeverity(error);
    }

    /**
     * エラー情報をログに出力する
     * @param {GameError} error ログに出力するエラー
     */
    static logError(error) {
        if (!this.config.logToConsole) return;

        const logDetails = {
            timestamp: error.timestamp,
            type: error.type,
            message: error.message,
            entityId: error.entityId || 'N/A',
            details: error.details,
            stack: error.stack
        };

        // エラータイプに応じた色付きログを出力（ブラウザ環境用）
        switch (error.type) {
            case ErrorType.VALIDATION_ERROR:
                console.warn('[VALIDATION ERROR]', logDetails);
                break;
            case ErrorType.CALCULATION_ERROR:
                console.error('[CALCULATION ERROR]', logDetails);
                break;
            case ErrorType.COMPONENT_ERROR:
                console.error('[COMPONENT ERROR]', logDetails);
                break;
            case ErrorType.ACTION_ERROR:
                console.error('[ACTION ERROR]', logDetails);
                break;
            default:
                console.error('[GAME ERROR]', logDetails);
        }
    }

    /**
     * エラーの重大度に応じて適切な処理を行う
     * @param {GameError} error 処理対象のエラー
     */
    static handleBySeverity(error) {
        // 現在はエラーを記録するのみ
        // 将来的には、特定の種類のエラーに対してゲームの再初期化や
        // ユーザーへの通知を行うなどの処理を追加可能
        switch (error.type) {
            case ErrorType.VALIDATION_ERROR:
                // 検証エラーは処理を続行可能
                break;
            case ErrorType.CALCULATION_ERROR:
                // 計算エラーはゲームロジックに影響する可能性があるため注意
                break;
            case ErrorType.COMPONENT_ERROR:
                // コンポーネントエラーは深刻な問題を示す可能性がある
                break;
            case ErrorType.ACTION_ERROR:
                // アクションエラーは戦闘フローに影響する可能性がある
                break;
            default:
                // その他のエラーも記録
                break;
        }
    }

    /**
     * エラー発生時にデフォルトの応答を返すための関数
     * @param {string} fallbackValue フォールバック値
     * @param {Error|GameError} error 発生したエラー
     * @returns {any} フォールバック値
     */
    static onErrorReturn(fallbackValue, error) {
        this.handle(error);
        return fallbackValue;
    }
}

/**
 * エラーハンドリングをラップするユーティリティ関数
 * @param {Function} fn エラーハンドリング対象の関数
 * @param {Object} [context] コンテキスト情報
 * @param {any} [fallbackValue] エラー発生時のフォールバック値
 * @returns {Function} ラップされた関数
 */
export function withErrorHandling(fn, context = {}, fallbackValue = null) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            return ErrorHandler.onErrorReturn(
                fallbackValue, 
                new GameError(
                    error.message,
                    ErrorType.SYSTEM_ERROR,
                    { ...context, originalArgs: args },
                    context.entityId || null
                )
            );
        }
    };
}