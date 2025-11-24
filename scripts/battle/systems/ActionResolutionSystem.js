/**
 * @file ActionResolutionSystem.js
 * @description 行動解決フェーズの管理を担当するシステム。
 * CombatResolution, EffectApplicator の責務を統合し、
 * 戦闘結果の判定、効果適用を同期的に実行する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, ActiveEffects, Parts, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, EffectType, ActionCancelReason } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, isValidTarget } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';
import { effectApplicators } from '../effects/applicators/applicatorIndex.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export class ActionResolutionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.effectApplicators = effectApplicators;
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    update(deltaTime) {}
    
    onExecutionAnimationCompleted(detail) {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }
        this.resolveAction(detail.entityId);
    }

    resolveAction(attackerId) {
        try {
            const components = this._getCombatComponents(attackerId);
            if (!components) {
                // コンポーネント不足で戦闘継続不可の場合は完了イベントを発行して安全に終了
                this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: attackerId });
                return;
            }
            
            // 1. ターゲットとガード情報の決定
            const targetContext = this._determineFinalTarget(components, attackerId);
            if (targetContext.shouldCancel) {
                this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: attackerId, reason: ActionCancelReason.TARGET_LOST });
                return;
            }

            // 2. 戦闘結果（命中・防御など）の計算
            const outcome = this._calculateCombatOutcome(attackerId, components, targetContext);

            // 3. 効果の生成 (計算上の結果)
            const resolvedEffects = this._processEffects(attackerId, components, targetContext, outcome);
            
            // 4. 効果の適用 (状態変更) とイベント通知
            this._applyEffectsAndNotify(attackerId, components, targetContext, outcome, resolvedEffects);

        } catch (error) {
            ErrorHandler.handle(error, { method: 'ActionResolutionSystem.resolveAction', attackerId });
            // エラー回復：強制的に行動完了扱いにしてゲーム進行のスタックを防ぐ
            this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: attackerId });
        }
    }

    /**
     * 最終的なターゲットと、ガードが発生するかどうかを決定します。
     */
    _determineFinalTarget(components, attackerId) {
        const { action, attackingPart } = components;
        
        // ターゲット必須アクションの検証
        const isTargetRequired = attackingPart.targetScope && (attackingPart.targetScope.endsWith('_SINGLE') || attackingPart.targetScope.endsWith('_TEAM'));
        
        // サポート行動以外で、ターゲットが無効になっている場合はキャンセル対象
        if (isTargetRequired && !attackingPart.isSupport && !isValidTarget(this.world, action.targetId, action.targetPartKey)) {
            console.warn(`ActionResolutionSystem: Target for entity ${attackerId} is no longer valid. Cancelling.`);
            return { shouldCancel: true };
        }

        let finalTargetId = action.targetId;
        let finalTargetPartKey = action.targetPartKey;
        let guardianInfo = null;

        // 攻撃アクションの場合、ガード判定を行う
        if (!attackingPart.isSupport && finalTargetId !== null) {
            const foundGuardian = findGuardian(this.world, finalTargetId);
            if (foundGuardian) {
                guardianInfo = foundGuardian;
                finalTargetId = guardianInfo.id;
                finalTargetPartKey = guardianInfo.partKey;
            }
        }

        const targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;

        return { 
            finalTargetId, 
            finalTargetPartKey, 
            targetLegs, 
            guardianInfo, 
            shouldCancel: false 
        };
    }

    _calculateCombatOutcome(attackerId, components, targetContext) {
        const { attackingPart } = components;
        const { finalTargetId, finalTargetPartKey, targetLegs } = targetContext;

        return CombatCalculator.resolveHitOutcome({
            world: this.world,
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            targetLegs,
            initialTargetPartKey: finalTargetPartKey
        });
    }

    _processEffects(attackerId, components, targetContext, outcome) {
        const { action, attackingPart, attackerInfo, attackerParts } = components;
        const { finalTargetId } = targetContext;
        const resolvedEffects = [];

        // 命中していない場合（かつターゲットが存在する場合）は効果なし
        if (!outcome.isHit && finalTargetId) {
            return resolvedEffects;
        }

        // 定義された効果ごとに処理
        for (const effectDef of attackingPart.effects || []) {
            const strategy = effectStrategies[effectDef.type];
            if (!strategy) continue;

            const result = strategy({
                world: this.world,
                sourceId: attackerId,
                targetId: finalTargetId,
                effect: effectDef,
                part: attackingPart,
                partKey: action.partKey,
                partOwner: { info: attackerInfo, parts: attackerParts },
                outcome,
            });

            if (result) {
                // 貫通属性を付与
                result.penetrates = attackingPart.penetrates || false;
                resolvedEffects.push(result);
            }
        }
        return resolvedEffects;
    }

    _applyEffectsAndNotify(attackerId, components, targetContext, outcome, resolvedEffects) {
        const { attackingPart } = components;
        const { finalTargetId, guardianInfo } = targetContext;

        // 全効果の適用
        const appliedEffects = this._applyAllEffects({ resolvedEffects, guardianInfo });
        
        // 完了イベント発行
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, {
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            isSupport: attackingPart.isSupport,
            guardianInfo,
            outcome,
            appliedEffects
        });
    }

    /**
     * 全ての効果を適用するプロセス。
     * 連鎖効果（貫通など）もここで再帰的/反復的に処理します。
     */
    _applyAllEffects({ resolvedEffects, guardianInfo }) {
        const appliedEffects = [];
        const effectQueue = [...resolvedEffects];

        // ガードが発動した場合、その回数を消費
        if (guardianInfo) {
            this._consumeGuardCount(guardianInfo.id);
        }

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            const applicator = this.effectApplicators[effect.type];
            if (!applicator) {
                console.warn(`ActionResolutionSystem: No applicator for "${effect.type}".`);
                continue;
            }

            // 適用実行
            const result = applicator({ world: this.world, effect });

            if (result) {
                appliedEffects.push(result);
                // 次の効果（例：貫通ダメージ）が生成された場合、キューの先頭に追加して即時処理
                if (result.nextEffect) {
                    effectQueue.unshift(result.nextEffect);
                }
            }
        }
        return appliedEffects;
    }

    _consumeGuardCount(guardianId) {
        const activeEffects = this.world.getComponent(guardianId, ActiveEffects);
        if (!activeEffects) return;

        const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
        if (guardEffect) {
            guardEffect.count--;
            if (guardEffect.count <= 0) {
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId: guardianId, effect: guardEffect });
            }
        }
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPart = attackerParts[action.partKey];
        if (!attackingPart) return null;

        return { action, attackerInfo, attackerParts, attackingPart };
    }
}