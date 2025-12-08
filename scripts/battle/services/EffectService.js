/**
 * @file EffectService.js
 * @description 戦闘におけるステータス補正や特性効果を一元管理するサービス。
 * TraitRegistryを利用して動的なロジックを実行するように拡張。
 */
import { ActiveEffects } from '../components/index.js';
import { EffectType } from '../../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitDefinitions } from '../../data/traitDefinitions.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';

export class EffectService {
    
    /**
     * 指定されたステータスに対する補正値を取得する (フック名: onCalculateStat)
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} statName 
     * @param {object} context 
     * @returns {number} 補正値（加算値）
     */
    static getStatModifier(world, entityId, statName, context = {}) {
        // コンテキストの拡張
        const fullContext = {
            ...context,
            world,
            entityId,
            targetStat: statName,
            currentVal: 0 // 必要であればベース値を渡す
        };

        let modifier = 0;

        // 1. 定義ファイル（Type/Trait）からのロジック実行
        modifier += this._executeTraitHooks('onCalculateStat', fullContext);

        // 2. アクティブ効果（バフ・デバフ）による補正 (既存ロジック)
        modifier += this._getActiveEffectModifier(world, entityId, statName);

        return modifier;
    }

    /**
     * 速度係数に対する補正を取得する (フック名: onCalculateSpeedMultiplier)
     */
    static getSpeedMultiplierModifier(world, entityId, part) {
        const context = { world, entityId, part, attackingPart: part };
        let multiplier = 1.0;

        // 定義ファイルからのロジック実行 (乗算として扱う)
        const factors = this._executeTraitHooks('onCalculateSpeedMultiplier', context, true); // true = collect all results
        
        if (factors.length > 0) {
            multiplier = factors.reduce((acc, val) => acc * val, 1.0);
        }

        return multiplier;
    }

    /**
     * クリティカル率への補正を取得する (フック名: onCalculateCritical)
     */
    static getCriticalChanceModifier(part) {
        if (!part) return 0;
        const context = { attackingPart: part };
        
        return this._executeTraitHooks('onCalculateCritical', context);
    }

    // --- Internal Logic ---

    /**
     * 攻撃パーツの Type と Trait に関連付けられたロジックフックを実行する
     * @param {string} hookName 実行するメソッド名
     * @param {object} context ロジックに渡すコンテキスト
     * @param {boolean} returnArray 結果を配列で返すか（乗算用）、合計値で返すか（加算用）
     */
    static _executeTraitHooks(hookName, context, returnArray = false) {
        const { attackingPart } = context;
        if (!attackingPart) return returnArray ? [] : 0;

        const results = [];
        let total = 0;

        // チェック対象の定義
        const definitions = [
            TypeDefinitions[attackingPart.type],
            TraitDefinitions[attackingPart.trait]
        ];

        for (const def of definitions) {
            if (!def) continue;

            // 1. 旧形式 (statModifiers配列) の互換処理 (onCalculateStatのみ)
            // データ定義を書き換えずに、自動的にTraitRegistryのロジックを適用する
            if (hookName === 'onCalculateStat' && def.statModifiers) {
                const logic = TraitRegistry.getLogic('STAT_MODIFIER');
                if (logic) {
                    for (const mod of def.statModifiers) {
                        const val = logic.onCalculateStat(context, mod);
                        if (val !== 0) {
                            results.push(val);
                            total += val;
                        }
                    }
                }
            }

            // 2. 新形式 (logicプロパティ) の処理
            if (def.logic) {
                const logicImpl = TraitRegistry.getLogic(def.logic);
                if (logicImpl && typeof logicImpl[hookName] === 'function') {
                    const val = logicImpl[hookName](context, def.params || {});
                    results.push(val);
                    total += val;
                }
            }
            
            // 3. 直接定義されたパラメータの処理 (speedMultiplier, criticalBonusなど)
            if (hookName === 'onCalculateSpeedMultiplier' && def.speedMultiplier !== undefined) {
                results.push(def.speedMultiplier);
            }
            if (hookName === 'onCalculateCritical' && def.criticalBonus !== undefined) {
                results.push(def.criticalBonus);
                total += def.criticalBonus;
            }
        }

        return returnArray ? results : total;
    }

    static _getActiveEffectModifier(world, entityId, statName) {
        let bonus = 0;
        if (!world || entityId === undefined || entityId === null) return 0;

        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (!activeEffects) return 0;

        if (statName === 'success') {
            const scanEffects = activeEffects.effects.filter(e => e.type === EffectType.APPLY_SCAN);
            bonus += scanEffects.reduce((sum, e) => sum + e.value, 0);
        }

        return bonus;
    }
}