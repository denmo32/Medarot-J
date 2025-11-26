import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType, PartKeyToInfoMap, EffectType, ActionCancelReason } from '../../../config/constants.js';
import { MessageTemplates, MessageKey } from '../../../data/messageRepository.js';
import { PlayerInfo } from '../../components/index.js';

const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export class MessageSystem extends System {
    constructor(world) {
        super(world);
        this.supportMessageFormatters = {
            [EffectType.HEAL]: this._formatHealMessage.bind(this),
            [EffectType.APPLY_SCAN]: this._formatScanMessage.bind(this),
            [EffectType.APPLY_GLITCH]: this._formatGlitchMessage.bind(this),
            [EffectType.APPLY_GUARD]: this._formatGuardMessage.bind(this),
        };
        
        this.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    onCombatSequenceResolved(detail) {
        const { attackerId, appliedEffects, targetId } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        const declarationSequence = this._createDeclarationSequence(attackerInfo, detail);
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: { ...detail },
            messageSequence: declarationSequence,
            immediate: true,
        });

        const shouldShowResult = targetId || (appliedEffects && appliedEffects.length > 0);

        if (shouldShowResult) {
            const resultSequence = this._createResultSequence(detail);
            
            if (resultSequence.length > 0) {
                this.world.emit(GameEvents.SHOW_MODAL, {
                    type: ModalType.EXECUTION_RESULT,
                    data: { ...detail },
                    messageSequence: resultSequence,
                    immediate: true
                });
            }
        }
    }

    _createDeclarationSequence(attackerInfo, detail) {
        const { targetId, attackingPart, isSupport, guardianInfo } = detail;
        const sequence = [];

        let mainMessageKey;
        const params = {
            attackerName: attackerInfo.name,
            actionType: attackingPart.action,
            attackType: attackingPart.type,
            trait: attackingPart.trait,
        };

        if (isSupport) {
            mainMessageKey = MessageKey.SUPPORT_DECLARATION;
        } else if (!targetId) {
            mainMessageKey = MessageKey.ATTACK_MISSED;
        } else {
            mainMessageKey = MessageKey.ATTACK_DECLARATION;
        }

        sequence.push({ text: this.format(mainMessageKey, params) });

        if (guardianInfo) {
            sequence.push({
                text: this.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: guardianInfo.name })
            });
        }

        return sequence;
    }

    _createResultSequence(detail) {
        const { targetId, isSupport, outcome, appliedEffects, guardianInfo } = detail;
        
        const isHealAction = appliedEffects && appliedEffects.some(e => e.type === EffectType.HEAL);
        if (isSupport && !isHealAction) {
            const supportMessage = this.generateSupportResultMessage(appliedEffects[0]);
            return [{ text: supportMessage }];
        }

        if (!outcome.isHit && targetId) {
            const targetName = this.world.getComponent(targetId, PlayerInfo)?.name || '相手';
            return [{ 
                text: this.format(MessageKey.ATTACK_EVADED, { targetName }) 
            }];
        }

        if (appliedEffects && appliedEffects.length > 0) {
            return this.generateDamageResultSequence(appliedEffects, guardianInfo);
        }

        return [];
    }

    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        const messageKey = cancelReasonToMessageKey[reason];
        if (!messageKey) return;
        
        const message = this.format(messageKey, { actorName: actorInfo.name });
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }

    onGuardBroken(detail) {
        const message = this.format(MessageKey.GUARD_BROKEN);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }
    
    generateDamageResultMessage(effects, guardianInfo) {
        if (!effects || effects.length === 0) return '';
        
        const messages = [];
        const firstEffect = effects[0];
    
        if (firstEffect.type === EffectType.HEAL) {
            messages.push(this._formatHealMessage(firstEffect));
        } else {
            this._appendDamageMessages(messages, effects, guardianInfo);
        }
    
        return messages.join('<br>');
    }

    _appendDamageMessages(messages, effects, guardianInfo) {
        const firstEffect = effects[0];
        
        let prefix = firstEffect.isCritical ? this.format(MessageKey.CRITICAL_HIT) : '';
        const targetInfo = this.world.getComponent(firstEffect.targetId, PlayerInfo);
        const partName = PartKeyToInfoMap[firstEffect.partKey]?.name || '不明部位';
        
        const params = {
            targetName: targetInfo?.name || '不明',
            guardianName: guardianInfo?.name || '不明',
            partName: partName,
            damage: firstEffect.value,
        };

        if (guardianInfo) {
            messages.push(prefix + this.format(MessageKey.GUARDIAN_DAMAGE, params));
        } else if (firstEffect.isDefended) {
            messages.push(prefix + this.format(MessageKey.DEFENSE_SUCCESS, params));
        } else {
            messages.push(prefix + this.format(MessageKey.DAMAGE_APPLIED, params));
        }

        for (let i = 1; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.isPenetration) {
                const penetratedPartName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
                messages.push(this.format(MessageKey.PENETRATION_DAMAGE, {
                    partName: penetratedPartName,
                    damage: effect.value,
                }));
            }
        }
    }

    generateDamageResultSequence(effects, guardianInfo) {
        const sequence = [];
        if (!effects || effects.length === 0) return [];
        
        const messageLines = this.generateDamageResultMessage(effects, guardianInfo).split('<br>');
        const hasHpChange = effects.some(e => (e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) && e.value > 0);

        if (messageLines.length > 0 && messageLines[0] !== '') {
            sequence.push({ text: messageLines[0] });

            if (hasHpChange) {
                sequence.push({ waitForAnimation: GameEvents.HP_BAR_ANIMATION_COMPLETED });
            }

            for (let i = 1; i < messageLines.length; i++) {
                sequence.push({ text: messageLines[i] });
            }
        }
        
        return sequence;
    }

    generateSupportResultMessage(effect) {
        if (!effect) return '支援行動成功！';
        const formatter = this.supportMessageFormatters[effect.type];
        return formatter ? formatter(effect) : '支援行動成功！';
    }

    _formatHealMessage(effect) {
        if (effect.value > 0) {
            const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            return this.format(MessageKey.HEAL_SUCCESS, { 
                targetName: targetInfo.name, 
                partName: partName, 
                healAmount: effect.value 
            });
        }
        return this.format(MessageKey.HEAL_FAILED);
    }

    _formatScanMessage(effect) {
        return this.format(MessageKey.SUPPORT_SCAN_SUCCESS, { 
            scanBonus: effect.value, 
            duration: effect.duration 
        });
    }

    _formatGlitchMessage(effect) {
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        return effect.wasSuccessful
            ? this.format(MessageKey.INTERRUPT_GLITCH_SUCCESS, { targetName: targetInfo.name })
            : this.format(MessageKey.INTERRUPT_GLITCH_FAILED);
    }

    _formatGuardMessage(effect) {
        return this.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
    }

    format(key, data = {}) {
        let template = MessageTemplates[key] || '';
        for (const placeholder in data) {
            template = template.replace(new RegExp(`{${placeholder}}`, 'g'), data[placeholder]);
        }
        return template;
    }
}