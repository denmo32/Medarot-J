/**
 * @file エラーハンドリングユーティリティ
 */

export const ErrorType = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CALCULATION_ERROR: 'CALCULATION_ERROR',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    COMPONENT_ERROR: 'COMPONENT_ERROR',
    ACTION_ERROR: 'ACTION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
};

export class GameError extends Error {
    constructor(message, type, details = {}, entityId = null) {
        super(message);
        this.name = 'GameError';
        this.type = type;
        this.details = details;
        this.entityId = entityId;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ErrorHandler {
    static config = {
        logToConsole: true,
        logToFile: false,
        severityThreshold: 'error',
    };

    static handle(error, context = {}) {
        if (!(error instanceof GameError)) {
            error = new GameError(
                error.message || 'Unknown error occurred',
                ErrorType.SYSTEM_ERROR,
                { originalError: error, context },
                context.entityId || null
            );
        }
        this.logError(error);
        this.handleBySeverity(error);
    }

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

        switch (error.type) {
            case ErrorType.VALIDATION_ERROR:
                console.warn('[VALIDATION ERROR]', logDetails);
                break;
            case ErrorType.CALCULATION_ERROR:
                console.error('[CALCULATION ERROR]', logDetails);
                break;
            default:
                console.error('[GAME ERROR]', logDetails);
        }
    }

    static handleBySeverity(error) {
        // 必要に応じて処理を追加
    }

    static onErrorReturn(fallbackValue, error) {
        this.handle(error);
        return fallbackValue;
    }
}

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