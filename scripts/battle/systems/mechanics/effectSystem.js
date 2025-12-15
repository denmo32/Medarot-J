/**
 * @file EffectSystem.js
 * @description エフェクト（バフ・デバフ）の持続時間管理と定期更新を行うシステム。
 * イベントリスナーを廃止し、Signalコンポーネントのポーリングに移行。
 */
import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, GameState } from '../../components/index.js';
import { ResetToCooldownRequest, CustomUpdateComponentRequest } from '../../components/CommandRequests.js';
import { ModalRequest, TurnEndedSignal } from '../../components/Requests.js';
import { GameEvents } from '../../../common/events.js'; // ログ出力用イベントは維持
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // 1. ターン終了シグナルの監視
        this._checkTurnEndSignal();

        // 2. エフェクトの毎フレーム更新処理（DoTダメージなど）
        this._updateContinuousEffects(deltaTime);
    }

    _checkTurnEndSignal() {
        const signals = this.getEntities(TurnEndedSignal);
        if (signals.length > 0) {
            // ターン終了処理の実行
            const allEntities = this.getEntities(ActiveEffects);
            allEntities.forEach(id => this._processTurnEndForEntity(id));

            // シグナルを消費（エンティティ削除）
            for (const id of signals) {
                this.world.destroyEntity(id);
            }
        }
    }

    _updateContinuousEffects(deltaTime) {
        const entities = this.getEntities(ActiveEffects);
        
        for (const entityId of entities) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            
            activeEffects.effects.forEach(effect => {
                const result = EffectRegistry.update(effect.type, {
                    world: this.world,
                    entityId,
                    effect,
                    deltaTime
                });

                if (result) {
                    if (result.damage > 0) {
                        // HP更新は重要な状態変化なので、イベントを発行してRenderSystem等に通知しても良いが
                        // 本来的にはここでもUpdateComponentRequestを使うのがECS的。
                        // ただしHP_UPDATEDイベントはログ用途も兼ねているため維持する。
                        this.world.emit(GameEvents.HP_UPDATED, {
                            entityId,
                            partKey: effect.partKey,
                            change: -result.damage,
                            isHeal: false,
                            ...result 
                        });
                    }
                    if (result.message) {
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

    _processTurnEndForEntity(entityId) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        if (!activeEffects || activeEffects.effects.length === 0) {
            return;
        }

        const effectsToRemove = [];
        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            let isExpired = false;
            const updatedEffect = { ...effect };

            // 持続時間の減算
            if (updatedEffect.duration > 0) {
                updatedEffect.duration--;
            }

            if (updatedEffect.duration !== undefined && updatedEffect.duration <= 0 && updatedEffect.duration !== Infinity) {
                isExpired = true;
            }

            if (isExpired) {
                effectsToRemove.push(effect);
                // 期限切れ通知 (ログ用)
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
        
        // 状態更新リクエストの発行
        if (effectsToRemove.length > 0) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new CustomUpdateComponentRequest(
                entityId,
                ActiveEffects,
                (ae) => {
                    // 現在の状態に対してフィルタリングを行う（並列更新への配慮）
                    ae.effects = ae.effects.filter(e => !effectsToRemove.includes(e));
                }
            ));
        } else if (nextEffects.length !== activeEffects.effects.length) {
            // 単純な置換で済む場合
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