import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, BattlePhase, TeamID, EffectType, EffectScope, PartInfo, TargetTiming } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * エンティティの「状態」を管理するステートマシンとしての役割を担うシステム。
 * [改善案] 責務を削減し、状態遷移ロジックのコア部分に特化させました。
 * - 行動選択後のセットアップは ActionSetupSystem へ移譲。
 * - 行動完了後のクールダウン移行は ActionResolutionSystem へ移譲。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // [改善案] 購読するイベントを削減
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.world.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
    }
    
    onPlayerBroken(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (gameState) {
            gameState.state = PlayerStateType.BROKEN;
        }
        if (gauge) {
            gauge.value = 0;
        }
        this.world.addComponent(entityId, new Action());
    }

    // [改善案] onActionSelected は ActionSetupSystem へ移譲されたため削除

    onActionExecuted(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            if (effect.type === EffectType.APPLY_GLITCH && effect.wasSuccessful) {
                // 妨害成功時、ターゲットを強制的にクールダウンへ
                this.resetEntityStateToCooldown(effect.targetId, { interrupted: true });
            } 
            else if (effect.type === EffectType.APPLY_GUARD) {
                // ガード成功時、自身の状態をガード中へ
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    
                    // アクションラインに留まるよう位置を固定
                    const position = this.world.getComponent(attackerId, Position);
                    const playerInfo = this.world.getComponent(attackerId, PlayerInfo);
                    if (position && playerInfo) {
                        position.x = playerInfo.teamId === TeamID.TEAM1
                            ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                            : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
                    }
                }
            }
        }
    }

    // [改善案] onAttackSequenceCompleted は廃止されたため削除

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        // 通常チャージ完了 -> 行動選択準備完了
        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        // 行動選択後チャージ完了 -> 行動実行準備完了
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;

            // 実行ラインへ移動（MovementSystemが位置を更新するが、念のため即時反映）
            const position = this.world.getComponent(entityId, Position);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            if (position && playerInfo) {
                position.x = playerInfo.teamId === TeamID.TEAM1
                    ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                    : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
        }
    }
    
    onActionCancelled(detail) {
        const { entityId } = detail;
        // 行動がキャンセルされた場合、中断されたものとしてクールダウンへ
        this.resetEntityStateToCooldown(entityId, { interrupted: true });
    }

    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        // ガード効果が切れた場合
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            const parts = this.world.getComponent(entityId, Parts);
            const guardPart = parts[effect.partKey];
            if (guardPart?.isBroken) {
                 this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
            }
            
            // 速度補正を元に戻す
            const gauge = this.world.getComponent(entityId, Gauge);
            if(gauge) gauge.speedMultiplier = 1.0;
            
            // 通常のクールダウンへ移行
            this.resetEntityStateToCooldown(entityId);
        }
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

        // ガード状態だった場合は解除
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }
        
        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            if (interrupted) {
                // 中断された場合、残りのチャージ量をクールダウン時間に変換
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            // 速度補正もリセット
            gauge.speedMultiplier = 1.0;
        }
        // Actionコンポーネントをクリア
        if (action) {
            this.world.addComponent(entityId, new Action());
        }
    }

    update(deltaTime) {
    }
}