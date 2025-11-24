/**
 * @file クールダウンシステム
 * @description 行動完了後のクールダウン移行処理を専門に担当するシステム。
 * StateSystemから責務を分割し、単一責任の原則を強化します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Action, GameState, Gauge, Parts, ActiveEffects } from '../core/components/index.js';
import { PlayerStateType, EffectType } from '../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';

export class CooldownSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // 行動が完了したことを通知するイベントを購読し、クールダウン処理を開始します。
        this.world.on(GameEvents.ACTION_COMPLETED, this.onActionCompleted.bind(this));
        // 妨害やパーツ破壊による行動キャンセル時にもクールダウンへ移行させます。
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        // 効果が切れた場合（例: ガード効果）にも状態をリセットします。
        this.world.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
        // HPバーアニメーション完了イベントを購読
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    /**
     * 行動完了イベントを処理し、クールダウンへ移行させます。
     * @param {object} detail - ACTION_COMPLETED イベントのペイロード { entityId }
     */
    onActionCompleted(detail) {
        this.transitionToCooldown(detail.entityId);
    }
    
    /**
     * 行動キャンセルイベントを処理し、クールダウンへ移行させます。
     * @param {object} detail - ACTION_CANCELLED イベントのペイロード { entityId }
     */
    onActionCancelled(detail) {
        this.resetEntityStateToCooldown(detail.entityId, { interrupted: true });
    }

    /**
     * HPバーアニメーション完了後にガード状態の解除を判定します。
     * @param {object} detail - HP_BAR_ANIMATION_COMPLETED イベントのペイロード { appliedEffects }
     */
    onHpBarAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            if (!effect.isPartBroken) continue;
            
            const { targetId: entityId, partKey } = effect;
            const gameState = this.world.getComponent(entityId, GameState);

            // ガード状態の機体でなければ何もしない
            if (gameState?.state !== PlayerStateType.GUARDING) {
                continue;
            }

            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (!activeEffects) continue;

            // 破壊されたパーツが、現在発動中のガード効果で使用されているパーツか確認
            const isGuardPartBroken = activeEffects.effects.some(
                activeEffect => activeEffect.type === EffectType.APPLY_GUARD && activeEffect.partKey === partKey
            );

            if (isGuardPartBroken) {
                // UIにガード破壊を通知
                this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
                // ガード状態をリセットしてクールダウンへ移行
                this.resetEntityStateToCooldown(entityId);
            }
        }
    }

    /**
     * 効果失効イベントを処理し、必要に応じて状態をリセットします。
     * @param {object} detail - EFFECT_EXPIRED イベントのペイロード { entityId, effect }
     */
    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        // ガード効果が切れ（回数が0になり）、かつガード状態だった場合にクールダウンへ移行
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            // パーツ破壊の判定は onPartBroken に集約されたため、ここでは不要
            this.resetEntityStateToCooldown(entityId);
        }
    }
    
    /**
     * 行動完了後のクールダウン移行処理。
     * @param {number} entityId 
     */
    transitionToCooldown(entityId) {
        const parts = this.world.getComponent(entityId, Parts);
        if (parts?.head?.isBroken) return;

        const gameState = this.world.getComponent(entityId, GameState);
        // ガード状態の機体はクールダウンに移行せず、Actionコンポーネントのみリセット
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            this.world.addComponent(entityId, new Action());
            return;
        }

        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        // クールダウン用の速度補正を計算
        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            if (usedPart) {
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: usedPart, factorType: 'cooldown' });
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }

        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            gauge.value = 0;
            gauge.currentSpeed = 0;
        }
        
        this.world.addComponent(entityId, new Action());
    }

    /**
     * エンティティの状態をクールダウン（CHARGING）にリセットします。
     * このメソッドは、妨害や効果切れなど、通常の行動フロー外で状態をリセットする必要がある場合に呼び出されます。
     * @param {number} entityId 
     * @param {object} [options={}]
     * @param {boolean} [options.interrupted=false] - 行動が中断されたか
     */
    resetEntityStateToCooldown(entityId, options = {}) {
        const { interrupted = false } = options;
        const parts = this.world.getComponent(entityId, Parts);
        
        if (parts?.head?.isBroken) {
            return;
        }
        
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        // ガード状態だった場合、関連する効果をクリア
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }
        
        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            // 中断された場合、ゲージの進行度を反転させてペナルティとする
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            gauge.currentSpeed = 0;
            gauge.speedMultiplier = 1.0;
        }
        if (action) {
            this.world.addComponent(entityId, new Action());
        }
    }
}