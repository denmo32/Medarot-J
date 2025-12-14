/**
 * @file EffectRegistry.js
 * @description 全てのアクション効果定義を集約管理するレジストリ。
 * apply メソッドは World を変更せず、更新データ(diff)を返す。
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType } from '../common/constants.js';
import { DamageEffect } from './effects/DamageEffect.js';
import { HealEffect } from './effects/HealEffect.js';
import { ScanEffect } from './effects/ScanEffect.js';
import { GlitchEffect } from './effects/GlitchEffect.js';
import { GuardEffect } from './effects/GuardEffect.js';
import { ConsumeGuardEffect } from './effects/ConsumeGuardEffect.js';
import { QueryService } from '../services/QueryService.js'; // QueryService をインポート
import { Parts } from '../../components/index.js';
import { UpdateComponentCommand } from '../common/Command.js';

const registry = {
    [EffectType.DAMAGE]: DamageEffect,
    [EffectType.HEAL]: HealEffect,
    [EffectType.APPLY_SCAN]: ScanEffect,
    [EffectType.APPLY_GLITCH]: GlitchEffect,
    [EffectType.APPLY_GUARD]: GuardEffect,
    [EffectType.CONSUME_GUARD]: ConsumeGuardEffect,
};

export class EffectRegistry {
    static get(type) {
        return registry[type] || null;
    }

    static process(type, context) {
        const def = this.get(type);
        if (def && typeof def.process === 'function') {
            return def.process(context);
        }
        return null;
    }

    /**
     * コンテキストからエフェクト定義を取得・処理し、結果をrawEffectsに追加する
     * @param {object} ctx - バトルコンテキスト
     */
    static processAll(ctx) {
        const { action, attackingPart, attackerInfo, attackerParts, finalTargetId, outcome } = ctx;

        // 命中しなかった場合はエフェクトを処理しない（サポート行動の場合は例外）
        if (!outcome.isHit && finalTargetId) {
            return;
        }

        for (const effectDef of attackingPart.effects || []) {
            const result = this.process(effectDef.type, {
                world: ctx.world,
                sourceId: ctx.attackerId,
                targetId: finalTargetId,
                effect: effectDef,
                part: attackingPart,
                partKey: action.partKey,
                partOwner: { info: attackerInfo, parts: attackerParts },
                outcome,
            });

            if (result) {
                result.penetrates = attackingPart.penetrates || false;
                result.calculation = effectDef.calculation;
                // MessageService経由でrawEffectsにプッシュ（ここではctx.rawEffectsに直接プッシュ）
                // -> ただし、`MessageService` は通常 `rawEffects` を更新しないので、ここは直接 `ctx` を操作する
                ctx.rawEffects.push(result);
            }
        }
    }

    /**
     * 適用データ生成フェーズ
     * Worldの現状を参照して、適用すべき状態変更(stateUpdates)と発生イベント(events)を生成して返す。
     * 実際にWorldを変更してはならない。
     */
    static apply(type, context) {
        const def = this.get(type);
        if (def && typeof def.apply === 'function') {
            return def.apply(context);
        }
        return { ...context.effect, events: [], stateUpdates: [] };
    }

    /**
     * 複数のエフェクトを順次適用し、ガードや貫通処理も行う。
     * @param {Array} rawEffects - 適用前のエフェクト配列
     * @param {object} ctx - バトルコンテキスト
     * @returns {Object} { appliedEffects, eventsToEmit, stateUpdates }
     */
    static applyAll(rawEffects, ctx) {
        const { world, finalTargetId } = ctx;
        const eventsToEmit = [];
        const allStateUpdates = [];
        const appliedEffects = [];

        // --- シミュレーションのセットアップ ---
        const targetPartsComponent = finalTargetId !== null ? world.getComponent(finalTargetId, Parts) : null;
        const simulatedParts = targetPartsComponent ? JSON.parse(JSON.stringify(targetPartsComponent)) : null;

        if (ctx.guardianInfo) {
            rawEffects.push({
                type: EffectType.CONSUME_GUARD,
                targetId: ctx.guardianInfo.id,
                partKey: ctx.guardianInfo.partKey
            });
        }

        const effectQueue = [...rawEffects];

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();

            const applyContext = { world, effect };
            if (simulatedParts && effect.targetId === finalTargetId) {
                applyContext.simulatedParts = simulatedParts;
            }

            const result = EffectRegistry.apply(effect.type, applyContext);

            if (result) {
                appliedEffects.push(result);

                if (result.events) eventsToEmit.push(...result.events);
                if (result.stateUpdates) allStateUpdates.push(...result.stateUpdates);

                // このエフェクト適用によって頭部が破壊されたかチェック
                const isTargetDefeated = simulatedParts?.head?.isBroken;

                // 貫通処理は、ターゲットがまだ機能停止していない場合にのみ続行
                if (result.isPartBroken && result.overkillDamage > 0 && result.penetrates && !isTargetDefeated) {
                    const nextTargetPartKey = QueryService.findRandomPenetrationTarget(
                        world,
                        result.targetId,
                        result.partKey,
                        simulatedParts
                    );

                    if (nextTargetPartKey) {
                        const nextEffect = {
                            type: EffectType.DAMAGE,
                            targetId: result.targetId,
                            partKey: nextTargetPartKey,
                            value: result.overkillDamage,
                            penetrates: true,
                            isPenetration: true,
                            calculation: result.calculation,
                            isCritical: result.isCritical
                        };
                        effectQueue.unshift(nextEffect);
                    }
                }
            }
        }

        // --- シミュレーション結果の差分から更新コマンドを生成 ---
        if (finalTargetId !== null && simulatedParts && targetPartsComponent) {
            const updates = {};
            let hasChanges = false;
            for (const partKey in simulatedParts) {
                const simPart = simulatedParts[partKey];
                const origPart = targetPartsComponent[partKey];
                if (simPart && origPart) {
                    if (simPart.hp !== origPart.hp || simPart.isBroken !== origPart.isBroken) {
                        updates[partKey] = {
                            hp: simPart.hp,
                            isBroken: simPart.isBroken
                        };
                        hasChanges = true;
                    }
                }
            }
            if (hasChanges) {
                allStateUpdates.push(new UpdateComponentCommand({
                    targetId: finalTargetId,
                    componentType: Parts,
                    updates: updates
                }));
            }
        }

        return { appliedEffects, eventsToEmit, stateUpdates: allStateUpdates };
    }

    static update(type, context) {
        const def = this.get(type);
        if (def && typeof def.update === 'function') {
            return def.update(context);
        }
        return null;
    }
}