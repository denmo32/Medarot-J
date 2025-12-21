/**
 * @file HookRegistry.js
 * @description 戦闘フローへの介入（フック）を管理するレジストリ。
 * コンテキストオブジェクトを通じて、フック登録者が処理の流れやデータを変更できるようにする。
 */

export const HookPhase = {
    // ターゲット決定時 (身代わり、ターゲット誘導など)
    ON_TARGET_RESOLVING: 'ON_TARGET_RESOLVING',
    
    // 命中・パラメータ計算時 (ステータス補正、クリティカル率変更など)
    ON_CALCULATE_STAT: 'ON_CALCULATE_STAT',
    ON_CALCULATE_CRITICAL: 'ON_CALCULATE_CRITICAL',
    ON_CALCULATE_SPEED_MULTIPLIER: 'ON_CALCULATE_SPEED_MULTIPLIER',

    // エフェクト適用直前 (ダメージ軽減、無効化など)
    BEFORE_EFFECT_APPLIED: 'BEFORE_EFFECT_APPLIED',

    // エフェクト適用直後 (貫通、反撃、追撃など)
    AFTER_EFFECT_APPLIED: 'AFTER_EFFECT_APPLIED',
};

export class HookRegistry {
    constructor() {
        this.hooks = new Map();
    }

    /**
     * フックを登録する
     * @param {string} phase HookPhase定数
     * @param {Function} callback (context) => void/value
     * @param {number} priority 実行優先度 (高い順に実行。デフォルト0)
     * @returns {Function} 解除用関数
     */
    register(phase, callback, priority = 0) {
        if (!this.hooks.has(phase)) {
            this.hooks.set(phase, []);
        }
        const phaseHooks = this.hooks.get(phase);
        phaseHooks.push({ callback, priority });
        
        // 優先度順（降順）にソート
        phaseHooks.sort((a, b) => b.priority - a.priority);

        return () => {
            const index = phaseHooks.findIndex(h => h.callback === callback);
            if (index !== -1) {
                phaseHooks.splice(index, 1);
            }
        };
    }

    /**
     * フックを実行し、コンテキストを変更させる (Void)
     * @param {string} phase 
     * @param {object} context 
     */
    execute(phase, context) {
        const phaseHooks = this.hooks.get(phase);
        if (!phaseHooks) return;

        for (const hook of phaseHooks) {
            // shouldStopPropagationフラグがあれば中断も可能にする（今回は未実装）
            hook.callback(context);
        }
    }

    /**
     * フックを実行し、結果（数値など）を集計して返す (Reduce/Map)
     * @param {string} phase 
     * @param {object} context 
     * @param {any} initialValue 
     * @param {Function} reducer (acc, result) => acc
     * @returns {any}
     */
    executeReduce(phase, context, initialValue, reducer) {
        const phaseHooks = this.hooks.get(phase);
        if (!phaseHooks) return initialValue;

        let acc = initialValue;
        for (const hook of phaseHooks) {
            const result = hook.callback(context);
            if (result !== undefined) {
                acc = reducer(acc, result);
            }
        }
        return acc;
    }
}