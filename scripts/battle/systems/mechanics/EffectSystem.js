/**
 * @file EffectSystem.js
 * @description エフェクト（バフ・デバフ）の持続時間管理と定期更新を行うシステム。
 * リファクタリング: メソッド分割による可読性向上
 */
import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, IsGuarding } from '../../components/index.js';
import { ResetToCooldownRequest, CustomUpdateComponentRequest } from '../../components/CommandRequests.js';
import {
    EffectExpiredEvent
} from '../../components/Requests.js';
import { EffectType } from '../../common/constants.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // 時間ベースのエフェクトの更新処理
        this._processTimeBasedEffects(deltaTime);
    }

    /**
     * 時間ベースのエフェクトの更新処理
     */
    _processTimeBasedEffects(deltaTime) {
        const allEntities = this.getEntities(ActiveEffects);
        for (const entityId of allEntities) {
            this._processTimeBasedEffectsForEntity(entityId, deltaTime);
        }
    }

    /**
     * 特定のエンティティの時間ベースエフェクトを更新する
     */
    _processTimeBasedEffectsForEntity(entityId, deltaTime) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        if (!activeEffects || activeEffects.effects.length === 0) {
            return;
        }

        // 時間ベースのエフェクトのみを処理
        const timeBasedEffects = activeEffects.effects.filter(e => e.tickInterval !== undefined);
        if (timeBasedEffects.length === 0) {
            return;
        }

        // 1. 期間の更新と期限切れ判定
        const { nextEffects, expiredEffects } = this._updateTimeBasedEffectsDuration(activeEffects.effects, deltaTime);

        // 2. 期限切れエフェクトの処理
        if (expiredEffects.length > 0) {
            this._handleExpiredEffects(entityId, expiredEffects);
        }

        // 3. コンポーネントの更新反映
        // 内容に変更があった場合のみ更新リクエストを発行
        if (nextEffects.length !== activeEffects.effects.length || this._hasTimeElapsed(timeBasedEffects, nextEffects)) {
            this._applyActiveEffectsUpdate(entityId, nextEffects);
        }
    }

    /**
     * 時間ベースのエフェクトの持続時間を更新し、継続するものと期限切れになるものに分類する
     */
    _updateTimeBasedEffectsDuration(currentEffects, deltaTime) {
        const nextEffects = [];
        const expiredEffects = [];

        for (const effect of currentEffects) {
            // ターンベースのエフェクト（tickIntervalが未定義）はそのまま
            if (effect.tickInterval === undefined) {
                nextEffects.push({ ...effect });
                continue;
            }

            let isExpired = false;
            const updatedEffect = { ...effect };

            // 経過時間の加算
            updatedEffect.elapsedTime = (updatedEffect.elapsedTime || 0) + deltaTime;

            // 期限切れ判定
            if (updatedEffect.duration !== undefined && updatedEffect.elapsedTime >= updatedEffect.duration && updatedEffect.duration !== Infinity) {
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
     * 時間経過があるかどうかを判定
     */
    _hasTimeElapsed(originalEffects, updatedEffects) {
        for (let i = 0; i < originalEffects.length; i++) {
            if (originalEffects[i].tickInterval !== undefined) {
                if (originalEffects[i].elapsedTime !== updatedEffects[i].elapsedTime) {
                    return true;
                }
            }
        }
        return false;
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
