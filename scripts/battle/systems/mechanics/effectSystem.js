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

        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            if (effect.duration > 0) {
                effect.duration--;
            }

            if (effect.duration === undefined || effect.duration > 0 || effect.duration === Infinity) {
                nextEffects.push(effect);
            } else {
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect });
                
                const gameState = this.world.getComponent(entityId, GameState);
                if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
                    const cmd = createCommand('RESET_TO_COOLDOWN', {
                        targetId: entityId,
                        options: {}
                    });
                    cmd.execute(this.world);
                }
            }
        }

        activeEffects.effects = nextEffects;
    }
}