/**
 * @file ActionResolutionSystem.js
 * @description 行動解決フェーズの管理を担当するシステム。
 * CombatResolution, EffectApplicator, HistorySystemの責務を統合し、
 * 戦闘結果の判定、効果適用、履歴更新を同期的に実行する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, ActiveEffects, BattleLog, GameState, Gauge, Parts, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType, EffectType, ActionType, PartInfo, ModalType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, findRandomPenetrationTarget, getValidAllies } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';

export class ActionResolutionSystem extends BaseSystem {
    /**
     * @param {World} world 
     */
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        // StateSystemへの直接参照を削除し、疎結合化を実現

        // updateループの代わりに、アニメーション完了イベントをトリガーとする
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
        // UIモーダル完了イベントの購読を削除。このシステムの責務ではなくなったため。
    }

    /**
     * このシステムはイベント駆動に変更されたため、updateループは不要
     * @param {number} deltaTime 
     */
    update(deltaTime) {
    }
    
    /**
     * アニメーション完了をトリガーに、アクション解決処理を開始する
     * @param {object} detail 
     */
    onExecutionAnimationCompleted(detail) {
        // 廃止されたACTION_RESOLUTIONフェーズのチェックを削除
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }
        this.resolveAction(detail.entityId);
    }

    resolveAction(attackerId) {
        const components = this._getCombatComponents(attackerId);
        if (!components) {
            // コンポーネントが取得できない場合、後続処理のために完了イベントを発行
            this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: attackerId });
            return;
        }
        const { action, attackerInfo, attackerParts } = components;
        const attackingPart = attackerParts[action.partKey];
        
        let finalTargetId = action.targetId;
        let finalTargetPartKey = action.targetPartKey;
        let targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;
        
        let guardianInfo = null;
        if (!attackingPart.isSupport && finalTargetId !== null) {
            guardianInfo = findGuardian(this.world, finalTargetId);
            if (guardianInfo) {
                finalTargetId = guardianInfo.id;
                finalTargetPartKey = guardianInfo.partKey;
                targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;
            }
        }

        const outcome = CombatCalculator.resolveHitOutcome({
            world: this.world,
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            targetLegs,
            initialTargetPartKey: finalTargetPartKey
        });
        finalTargetPartKey = outcome.finalTargetPartKey;

        const resolvedEffects = [];
        if (outcome.isHit || !finalTargetId) {
            for (const effectDef of attackingPart.effects || []) {
                const strategy = effectStrategies[effectDef.type];
                if (strategy) {
                    const result = strategy({
                        world: this.world,
                        sourceId: attackerId,
                        targetId: finalTargetId,
                        effect: effectDef,
                        part: attackingPart,
                        partKey: action.partKey,
                        partOwner: { info: attackerInfo, parts: attackerParts },
                        outcome: { ...outcome, finalTargetPartKey },
                    });
                    if (result) {
                        result.penetrates = attackingPart.penetrates || false;
                        resolvedEffects.push(result);
                    }
                }
            }
        }
        
        const appliedEffects = this.applyAllEffects({ attackerId, resolvedEffects, guardianInfo });
        
        // 履歴更新時に使用するため、attackingPartを渡す
        this.updateHistory({ attackerId, appliedEffects, attackingPart });
        
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

    applyAllEffects({ attackerId, resolvedEffects, guardianInfo }) {
        const appliedEffects = [];
        const effectQueue = [...resolvedEffects];

        if (guardianInfo) {
            const guardEffect = this.world.getComponent(guardianInfo.id, ActiveEffects)?.effects.find(e => e.type === EffectType.APPLY_GUARD);
            if (guardEffect) {
                guardEffect.count--;
                if (guardEffect.count <= 0) this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId: guardianInfo.id, effect: guardEffect });
            }
        }

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            let result = null;
            switch(effect.type) {
                case EffectType.DAMAGE: result = this._applyDamage(effect); break;
                case EffectType.HEAL: result = this._applyHeal(effect); break;
                case EffectType.APPLY_SCAN: this._applyTeamEffect(effect); result = effect; break;
                case EffectType.APPLY_GUARD: this._applySingleEffect({ ...effect, targetId: attackerId }); result = effect; break;
                default: result = effect;
            }

            if (result) {
                appliedEffects.push(result);
                if (result.isPartBroken && result.penetrates && result.overkillDamage > 0) {
                    const nextTarget = findRandomPenetrationTarget(this.world, result.targetId, result.partKey);
                    if (nextTarget) {
                        effectQueue.unshift({ ...effect, partKey: nextTarget, value: result.overkillDamage, isPenetration: true });
                    }
                }
            }
        }
        return appliedEffects;
    }

    _applyDamage(effect) {
        const { targetId, partKey, value } = effect;
        const part = this.world.getComponent(targetId, Parts)?.[partKey];
        if (!part) return null;

        const oldHp = part.hp;
        const newHp = Math.max(0, oldHp - value);
        part.hp = newHp;
        const actualDamage = oldHp - newHp;
        const isPartBroken = oldHp > 0 && newHp === 0;

        this.world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp, maxHp: part.maxHp, change: -actualDamage, isHeal: false });
        if (isPartBroken) {
            part.isBroken = true;
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey });
            if (partKey === PartInfo.HEAD.key) {
                this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId, teamId: this.world.getComponent(targetId, PlayerInfo).teamId });
            }
        }
        return { ...effect, value: actualDamage, isPartBroken, overkillDamage: value - actualDamage };
    }
    
    _applyHeal(effect) {
        const { targetId, partKey, value } = effect;
        if (!targetId) return effect;

        const part = this.world.getComponent(targetId, Parts)?.[partKey];
        if (!part) return null;

        let actualHealAmount = 0;
        if (!part.isBroken) {
            const oldHp = part.hp;
            part.hp = Math.min(part.maxHp, part.hp + value);
            actualHealAmount = part.hp - oldHp;
            if (actualHealAmount > 0) {
                this.world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp: part.hp, maxHp: part.maxHp, change: actualHealAmount, isHeal: true });
            }
        }
        return { ...effect, value: actualHealAmount };
    }

    _applyTeamEffect(effect) {
        if (!effect.scope?.endsWith('_TEAM')) return;
        const sourceInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        if (!sourceInfo) return;
        const allies = getValidAllies(this.world, effect.targetId, true);
        allies.forEach(id => this._applySingleEffect({ ...effect, targetId: id }));
    }

    _applySingleEffect(effect) {
        const activeEffects = this.world.getComponent(effect.targetId, ActiveEffects);
        if (!activeEffects) return;
        activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
        activeEffects.effects.push({
            type: effect.type,
            value: effect.value,
            duration: effect.duration,
            count: effect.value,
            partKey: effect.partKey,
        });
    }
    
    /**
     * 履歴更新ロジックを厳格化
     * @param {object} context
     * @param {number} context.attackerId
     * @param {Array<object>} context.appliedEffects
     * @param {object} context.attackingPart
     */
    updateHistory({ attackerId, appliedEffects, attackingPart }) {
        // 履歴更新の対象となる主要な効果を探す (ダメージまたは回復)
        const mainEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!mainEffect) return;

        const { targetId, partKey } = mainEffect;
        if (targetId === null || targetId === undefined) return;
        
        // --- 1. 個人履歴 (BattleLog) の更新 ---
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) {
            // FOCUS性格などのために、行動対象は常に記録する
            attackerLog.lastAttack = { targetId, partKey };
        }
        
        // ダメージを与えた場合のみ、被攻撃履歴を更新
        if (mainEffect.type === EffectType.DAMAGE) {
            const targetLog = this.world.getComponent(targetId, BattleLog);
            if (targetLog) {
                targetLog.lastAttackedBy = attackerId;
            }
        }

        // --- 2. チーム履歴 (BattleContext) の更新 ---
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);

        // 攻撃アクションの場合のみ teamLastAttack を更新する
        // これにより、回復行動がASSIST性格のターゲット選択に影響を与えるのを防ぐ
        if (!attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        // 敵リーダーにダメージを与えた場合のみ leaderLastAttackedBy を更新する
        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        return { action, attackerInfo, attackerParts };
    }
}