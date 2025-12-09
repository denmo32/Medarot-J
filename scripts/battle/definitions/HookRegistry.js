/**
 * @file HookRegistry.js
 * @description 戦闘解決フローなどの重要プロセスに対する介入処理（フック）を管理するレジストリ。
 * インスタンスとしてBattleContext等で保持・管理されることを想定。
 */

export const HookPhase = {
    BEFORE_COMBAT_CALCULATION: 'BEFORE_COMBAT_CALCULATION', // 攻撃開始前（トラップ、カウンター）
    AFTER_HIT_CALCULATION: 'AFTER_HIT_CALCULATION',         // 命中判定後（絶対回避、身代わり）
    BEFORE_EFFECT_APPLICATION: 'BEFORE_EFFECT_APPLICATION', // 効果適用前（ダメージ軽減、耐性）
    AFTER_EFFECT_APPLICATION: 'AFTER_EFFECT_APPLICATION',   // 効果適用後（反撃、追撃）
};

export class HookRegistry {
    constructor() {
        this.hooks = new Map();
    }

    /**
     * フックを登録する
     * @param {string} phase HookPhase定数
     * @param {Function} callback (context) => void
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

        // 解除関数を返す
        return () => {
            const index = phaseHooks.findIndex(h => h.callback === callback);
            if (index !== -1) {
                phaseHooks.splice(index, 1);
            }
        };
    }

    /**
     * フックを実行する
     * @param {string} phase HookPhase定数
     * @param {object} context 変更可能なコンテキストオブジェクト
     */
    execute(phase, context) {
        const phaseHooks = this.hooks.get(phase);
        if (!phaseHooks) return;

        for (const hook of phaseHooks) {
            // フック内で context.shouldCancel が true にされた場合などは
            // 以降のフックを中断するなどの制御もここで行えるが、
            // 現状は全てのフックを実行する方針とする（複数のトラップ発動などを考慮）
            hook.callback(context);
        }
    }

    /**
     * 全てのフックを削除する
     */
    clear() {
        this.hooks.clear();
    }
}