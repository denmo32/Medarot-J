/**
 * @file EffectSystem.js
 * @description エフェクト（バフ・デバフ）の持続時間管理と定期更新を行うシステム。
 * リファクタリング: メソッド分割による可読性向上
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

        // 2. エフェクトの毎フレーム更新処理 (必要に応じて実装)
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

        // 1. 期間の更新と期限切れ判定
        const { nextEffects, expiredEffects } = this._updateEffectsDuration(activeEffects.effects);

        // 2. 期限切れエフェクトの処理
        if (expiredEffects.length > 0) {
            this._handleExpiredEffects(entityId, expiredEffects);
        }

        // 3. コンポーネントの更新反映
        // 内容に変更があった場合のみ更新リクエストを発行
        if (nextEffects.length !== activeEffects.effects.length) {
            this._applyActiveEffectsUpdate(entityId, nextEffects);
        }
    }

    /**
     * エフェクトの持続時間を更新し、継続するものと期限切れになるものに分類する
     */
    _updateEffectsDuration(currentEffects) {
        const nextEffects = [];
        const expiredEffects = [];

        for (const effect of currentEffects) {
            let isExpired = false;
            const updatedEffect = { ...effect };

            // 持続時間の減算 (Infinityの場合は減算しない)
            if (updatedEffect.duration > 0 && updatedEffect.duration !== Infinity) {
                updatedEffect.duration--;
            }

            // 期限切れ判定
            if (updatedEffect.duration !== undefined && updatedEffect.duration <= 0 && updatedEffect.duration !== Infinity) {
                isExpired = true;
            }

            if (isExpired) {
                expiredEffects.push(effect); // 元のオブジェクトを保持
            } else {
                nextEffects.push(updatedEffect);
            }
        }

        return { nextEffects, expiredEffects };
    }

    /**
     * 期限切れエフェクトに対する副作用（イベント発行、ガード解除など）を処理する
     */
    _handleExpiredEffects(entityId, expiredEffects) {
        for (const effect of expiredEffects) {
            // 期限切れイベントコンポーネントを生成 (ログ出力等に使用)
            const evt = this.world.createEntity();
            this.world.addComponent(evt, new EffectExpiredEvent(entityId, effect));

            // ガード解除時の特別処理
            if (effect.type === EffectType.APPLY_GUARD && this.world.getComponent(entityId, IsGuarding)) {
                const req = this.world.createEntity();
                this.world.addComponent(req, new ResetToCooldownRequest(entityId, {}));
            }
        }
    }

    /**
     * ActiveEffectsコンポーネントを更新するリクエストを発行する
     */
    _applyActiveEffectsUpdate(entityId, nextEffects) {
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