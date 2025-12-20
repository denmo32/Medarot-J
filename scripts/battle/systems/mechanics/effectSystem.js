/**
 * @file EffectSystem.js
 * @description エフェクト（バフ・デバフ）の持続時間管理と定期更新を行うシステム。
 * GameState依存を削除し、タグコンポーネント(IsGuarding)のチェックへ修正。
 */
import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, IsGuarding } from '../../components/index.js';
import { ResetToCooldownRequest, CustomUpdateComponentRequest } from '../../components/CommandRequests.js';
import {
    TurnEndedSignal,
    EffectExpiredEvent
} from '../../components/Requests.js';
import { EffectType } from '../../common/constants.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // 1. ターン終了シグナルの監視
        this._checkTurnEndSignal();

        // 2. エフェクトの毎フレーム更新処理
        // 必要に応じて実装
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
            if (updatedEffect.duration > 0 && updatedEffect.duration !== Infinity) {
                updatedEffect.duration--;
            }

            if (updatedEffect.duration !== undefined && updatedEffect.duration <= 0 && updatedEffect.duration !== Infinity) {
                isExpired = true;
            }

            if (isExpired) {
                effectsToRemove.push(effect);
                
                // 期限切れイベントコンポーネントを生成 (ログ用)
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new EffectExpiredEvent(entityId, updatedEffect));
                
                // ガード解除時の特別処理
                // IsGuardingタグを持っているか確認
                if (updatedEffect.type === EffectType.APPLY_GUARD && this.world.getComponent(entityId, IsGuarding)) {
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
                    // 現在の状態に対してフィルタリングを行う
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