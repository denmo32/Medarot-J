/**
 * @file DamageEffect.js
 * @description ダメージ効果の定義 (計算・適用・演出)
 */
import { EffectType, PartInfo } from '../../../common/constants.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { GameState, ActiveEffects } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, ModalType } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { createUiAnimationTask, createDialogTask } from '../../tasks/BattleTasks.js';
import { PartKeyToInfoMap } from '../../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';

export const DamageEffect = {
    type: EffectType.DAMAGE,

    // --- 計算フェーズ ---
    process: ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
        if (!targetId || !outcome.isHit) {
            return null;
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts) return null;

        const calcParams = effect.calculation || {};

        const finalDamage = CombatCalculator.calculateDamage({
            world: world,
            attackerId: sourceId,
            attackingPart: part,
            attackerLegs: partOwner.parts.legs,
            targetLegs: targetParts.legs,
            isCritical: outcome.isCritical,
            isDefenseBypassed: !outcome.isCritical && outcome.isDefended,
            calcParams: calcParams
        });

        return {
            type: EffectType.DAMAGE,
            targetId: targetId,
            partKey: outcome.finalTargetPartKey, 
            value: finalDamage,
            isCritical: outcome.isCritical,
            isDefended: outcome.isDefended,
        };
    },

    // --- 適用フェーズ ---
    apply: ({ world, effect }) => {
        const { targetId, partKey, value } = effect;
        const part = world.getComponent(targetId, Parts)?.[partKey];
        if (!part) return null;

        const oldHp = part.hp;
        const newHp = Math.max(0, oldHp - value);
        
        const actualDamage = oldHp - newHp;
        const isPartBroken = oldHp > 0 && newHp === 0;
        let isPlayerBroken = false;
        let isGuardBroken = false;

        const events = [];
        events.push({
            type: GameEvents.HP_UPDATED,
            payload: { 
                entityId: targetId, 
                partKey, 
                newHp, 
                oldHp, 
                maxHp: part.maxHp, 
                change: -actualDamage, 
                isHeal: false 
            }
        });
        
        if (isPartBroken) {
            events.push({
                type: GameEvents.PART_BROKEN,
                payload: { entityId: targetId, partKey }
            });

            if (partKey === PartInfo.HEAD.key) {
                isPlayerBroken = true;
            }

            // ガード破壊判定
            const targetState = world.getComponent(targetId, GameState);
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            
            if (targetState && targetState.state === PlayerStateType.GUARDING && activeEffects) {
                const isGuardPart = activeEffects.effects.some(
                    e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey
                );
                if (isGuardPart) {
                    isGuardBroken = true;
                    // ガード解除イベントとクールダウン移行リクエストを発行
                    events.push({
                        type: GameEvents.GUARD_BROKEN,
                        payload: { entityId: targetId }
                    });
                    events.push({
                        type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
                        payload: { entityId: targetId, options: {} }
                    });
                }
            }
        }

        const overkillDamage = value - actualDamage;

        // 状態更新
        part.hp = newHp;
        if (isPartBroken) {
            part.isBroken = true;
        }

        return { 
            ...effect, 
            value: actualDamage,
            oldHp, 
            newHp, 
            isPartBroken, 
            isPlayerBroken,
            isGuardBroken, 
            overkillDamage: overkillDamage,
            events: events
        };
    },

    // --- 演出フェーズ ---
    createTasks: ({ world, effects, guardianInfo, messageGenerator }) => {
        const tasks = [];
        
        // メッセージ生成
        const messageLines = [];
        const firstEffect = effects[0];

        // プレフィックス (クリティカル)
        let prefix = firstEffect.isCritical ? messageGenerator.format(MessageKey.CRITICAL_HIT) : '';

        // 各効果のメッセージ生成
        effects.forEach((effect, index) => {
            const targetInfo = world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            
            const params = {
                targetName: targetInfo?.name || '不明',
                guardianName: guardianInfo?.name || '不明',
                partName: partName,
                damage: effect.value,
            };

            if (index === 0) {
                if (guardianInfo) {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.GUARDIAN_DAMAGE, params));
                } else if (effect.isDefended) {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.DEFENSE_SUCCESS, params));
                } else {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.DAMAGE_APPLIED, params));
                }
            } else {
                // 貫通など
                if (effect.isPenetration) {
                     messageLines.push(messageGenerator.format(MessageKey.PENETRATION_DAMAGE, params));
                }
            }

            if (effect.isGuardBroken) {
                messageLines.push(messageGenerator.format(MessageKey.GUARD_BROKEN));
            }
        });

        if (messageLines.length > 0) {
            // 最初の行を表示
            tasks.push(createDialogTask(messageLines[0], { modalType: ModalType.EXECUTION_RESULT }));

            // HPバーアニメーション
            if (effects.some(e => e.value > 0)) {
                tasks.push(createUiAnimationTask('HP_BAR', { effects: effects }));
            }

            // 残りの行を表示
            for (let i = 1; i < messageLines.length; i++) {
                tasks.push(createDialogTask(messageLines[i], { modalType: ModalType.EXECUTION_RESULT }));
            }
        }

        return tasks;
    }
};