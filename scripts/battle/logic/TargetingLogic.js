/**
 * @file TargetingLogic.js
 * @description ターゲット戦略の結果正規化など、Worldに依存しない純粋なロジックを提供。
 */

export const TargetingLogic = {
    /**
     * AI戦略の戻り値を統一フォーマットに正規化する
     * @param {object|Array} result - AI戦略関数の戻り値
     * @returns {object|null} { targetId, targetPartKey }
     */
    normalizeStrategyResult(result) {
        if (!result) return null;
        
        // 配列形式（重み付きリスト）の場合、先頭を採用
        if (Array.isArray(result)) {
            if (result.length === 0) return null;
            const candidate = result[0];
            if (candidate && candidate.target) {
                return {
                    targetId: candidate.target.targetId,
                    targetPartKey: candidate.target.targetPartKey
                };
            }
            return null;
        }
        
        // 単一オブジェクト形式の場合
        if (result.targetId !== undefined) {
            return {
                targetId: result.targetId,
                targetPartKey: result.targetPartKey
            };
        }
        
        return null;
    }
};