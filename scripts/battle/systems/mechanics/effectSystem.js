import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, GameState } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.TURN_END, this.onTurnEnd.bind(this));
    }

    /**
     * 毎フレームの更新処理
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        const entities = this.getEntities(ActiveEffects);
        
        for (const entityId of entities) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            
            // 各エフェクトに対して更新処理を委譲
            activeEffects.effects.forEach(effect => {
                const result = EffectRegistry.update(effect.type, {
                    world: this.world,
                    entityId,
                    effect,
                    deltaTime
                });

                // 時間経過処理による副作用のハンドリング
                if (result) {
                    if (result.damage > 0) {
                        this.world.emit(GameEvents.HP_UPDATED, {
                            entityId,
                            partKey: effect.partKey,
                            change: -result.damage,
                            isHeal: false,
                            ...result // oldHp, newHpなどが含まれる場合
                        });
                    }
                    if (result.message) {
                        this.world.emit(GameEvents.SHOW_MODAL, {
                            type: 'MESSAGE',
                            data: { message: result.message },
                            immediate: true
                        });
                    }
                }
            });
        }
    }

    onTurnEnd(detail) {
        const allEntities = this.getEntities(ActiveEffects);
        allEntities.forEach(id => this._updateEffectsForEntity(id));
    }

    _updateEffectsForEntity(entityId) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        if (!activeEffects || activeEffects.effects.length === 0) {
            return;
        }

        const commandsToExecute = [];
        const effectsToRemove = [];
        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            let isExpired = false;
            const updatedEffect = { ...effect };

            if (updatedEffect.duration > 0) {
                updatedEffect.duration--;
            }

            if (updatedEffect.duration !== undefined && updatedEffect.duration <= 0 && updatedEffect.duration !== Infinity) {
                isExpired = true;
            }

            if (isExpired) {
                effectsToRemove.push(effect); // 元のオブジェクトを削除対象に
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect: updatedEffect });
                
                const gameState = this.world.getComponent(entityId, GameState);
                if (updatedEffect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
                    commandsToExecute.push(createCommand('RESET_TO_COOLDOWN', {
                        targetId: entityId,
                        options: {}
                    }));
                }
            } else {
                nextEffects.push(updatedEffect);
            }
        }
        
        // 状態変更をコマンド経由に統一
        if (effectsToRemove.length > 0) {
            // エフェクト配列の更新コマンドを最初に実行
            commandsToExecute.unshift(createCommand('CUSTOM_UPDATE', {
                targetId: entityId,
                componentType: ActiveEffects,
                customHandler: (ae) => {
                    ae.effects = ae.effects.filter(e => !effectsToRemove.includes(e));
                }
            }));
        }

        if (commandsToExecute.length > 0) {
            CommandExecutor.executeCommands(this.world, commandsToExecute);
        } else if (effectsToRemove.length === 0 && nextEffects.length !== activeEffects.effects.length) {
            // durationのみ更新された場合
            const cmd = createCommand('CUSTOM_UPDATE', {
                targetId: entityId,
                componentType: ActiveEffects,
                customHandler: (ae) => {
                    ae.effects = nextEffects;
                }
            });
            cmd.execute(this.world);
        }
    }
}