/**
 * @file ActionResolutionSystem.js (新規作成)
 * @description 行動解決フェーズの管理を担当するシステム。
 * CombatResolution, EffectApplicator, HistorySystemの責務を統合し、
 * 戦闘結果の判定、効果適用、履歴更新を同期的に実行する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, ActiveEffects, BattleLog, GameState, Parts, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType, EffectType, ActionType, PartInfo, ModalType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, findRandomPenetrationTarget, getValidAllies } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';

export class ActionResolutionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);

        // [追加] UIの結果表示モーダル完了イベントを購読する
        this.world.on(GameEvents.MODAL_SEQUENCE_COMPLETED, this.onModalSequenceCompleted.bind(this));
    }

    update(deltaTime) {
        if (this.battleContext.phase !== BattlePhase.ACTION_RESOLUTION) {
            return;
        }

        const resolvedAction = this.battleContext.turn.resolvedActions.shift();
        if (!resolvedAction) {
            this.endResolutionPhase();
            return;
        }
        
        this.resolveAction(resolvedAction.entityId);
    }

    /**
     * [追加] UIモーダルの完了イベントハンドラ
     * @param {object} detail 
     */
    onModalSequenceCompleted(detail) {
        const { modalType, originalData } = detail;

        // 実行結果モーダルが完了したら、攻撃シーケンスの完了を通知する
        if (modalType === ModalType.EXECUTION_RESULT && originalData && originalData.attackerId !== undefined) {
            this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: originalData.attackerId });
        }
    }
    
    resolveAction(attackerId) {
        const components = this._getCombatComponents(attackerId);
        if (!components) {
            this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: attackerId });
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
        
        this.world.emit(GameEvents.ACTION_DECLARED, { attackerId, targetId: finalTargetId, attackingPart, isSupport: attackingPart.isSupport, guardianInfo });
        
        const appliedEffects = this.applyAllEffects({ attackerId, resolvedEffects, guardianInfo });
        
        this.updateHistory({ attackerId, appliedEffects });
        
        this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId, targetId: finalTargetId, appliedEffects, isEvaded: !outcome.isHit, isSupport: attackingPart.isSupport, guardianInfo });
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
    
    updateHistory({ attackerId, appliedEffects }) {
        const damageEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE);
        if (!damageEffect) return;
        const { targetId, partKey } = damageEffect;
        if (!targetId) return;
        
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) attackerLog.lastAttack = { targetId, partKey };
        
        const targetLog = this.world.getComponent(targetId, BattleLog);
        if (targetLog) targetLog.lastAttackedBy = attackerId;
        
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);
        this.battleContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        if (targetInfo.isLeader) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }

    endResolutionPhase() {
        this.battleContext.turn.selectedActions.clear();
        this.battleContext.turn.resolvedActions = [];
        this.battleContext.phase = BattlePhase.TURN_END;
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        if (!action || !attackerInfo || !attackerParts) return null;
        return { action, attackerInfo, attackerParts };
    }
}