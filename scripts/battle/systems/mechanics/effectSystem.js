import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, GameState } from '../../components/index.js';
import { ResetToCooldownRequest, CustomUpdateComponentRequest } from '../../components/CommandRequests.js';
import { ModalRequest } from '../../components/Requests.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
        // TURN_ENDイベントはGameFlow/TurnSystemから発行されるが、
        // システム間連携の明確化のため、TurnSystemが発行するイベントをリッスンする形は維持するか、
        // TurnEndResultコンポーネントを監視する形にする。
        // ここではTurnSystem側には手を入れていない（既存）ため、イベント監視を維持しつつ、
        // 内部処理でイベント発行をリクエストコンポーネント生成に置換する。
        this.on(GameEvents.TURN_END, this.onTurnEnd.bind(this));
    }

    update(deltaTime) {
        const entities = this.getEntities(ActiveEffects);
        
        for (const entityId of entities) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            
            // 各エフェクト更新
            activeEffects.effects.forEach(effect => {
                const result = EffectRegistry.update(effect.type, {
                    world: this.world,
                    entityId,
                    effect,
                    deltaTime
                });

                if (result) {
                    if (result.damage > 0) {
                        this.world.emit(GameEvents.HP_UPDATED, {
                            entityId,
                            partKey: effect.partKey,
                            change: -result.damage,
                            isHeal: false,
                            ...result 
                        });
                    }
                    if (result.message) {
                        // モーダルリクエストコンポーネント生成
                        const req = this.world.createEntity();
                        this.world.addComponent(req, new ModalRequest(
                            'MESSAGE',
                            { message: result.message },
                            {
                                messageSequence: [{ text: result.message }],
                                priority: 'high'
                            }
                        ));
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
                effectsToRemove.push(effect);
                // 期限切れイベント通知
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect: updatedEffect });
                
                const gameState = this.world.getComponent(entityId, GameState);
                if (updatedEffect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
                    const req = this.world.createEntity();
                    this.world.addComponent(req, new ResetToCooldownRequest(entityId, {}));
                }
            } else {
                nextEffects.push(updatedEffect);
            }
        }
        
        if (effectsToRemove.length > 0) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new CustomUpdateComponentRequest(
                entityId,
                ActiveEffects,
                (ae) => {
                    ae.effects = ae.effects.filter(e => !effectsToRemove.includes(e));
                }
            ));
        } else if (nextEffects.length !== activeEffects.effects.length) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new CustomUpdateComponentRequest(
                entityId,
                ActiveEffects,
                (ae) => {
                    ae.effects = nextEffects;
                }
            ));
        }
    }
}