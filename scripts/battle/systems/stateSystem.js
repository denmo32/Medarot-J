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
 * 責務を削減し、状態遷移ロジックのコア部分に特化させました。
 * - 行動選択後のセットアップは ActionSetupSystem へ移譲。
 * - 行動完了後のクールダウン移行はこのシステムが一元管理します。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // ACTION_EXECUTEDは妨害・ガードなどの即時状態変化にのみ使用する
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.world.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
        // ACTION_RESOLUTION_FINISHEDイベントは廃止され、
        // ActionResolutionSystemからtransitionToCooldownが直接呼び出されるようになったため、
        // このイベントの購読は不要になりました。
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

    /**
     * イベント名をACTION_EXECUTEDからCOMBAT_SEQUENCE_RESOLVEDに変更。
     * 妨害やガードといった、行動解決時に即座に状態を変化させる効果を処理します。
     * @param {object} detail 
     */
    onCombatSequenceResolved(detail) {
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

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;

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
        this.resetEntityStateToCooldown(entityId, { interrupted: true });
    }

    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            const parts = this.world.getComponent(entityId, Parts);
            const guardPart = parts[effect.partKey];
            if (guardPart?.isBroken) {
                 this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
            }
            
            this.resetEntityStateToCooldown(entityId);
        }
    }

    /**
     * ActionResolutionSystemから直接呼び出される、行動完了後のクールダウン移行処理。
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
        if (gauge) gauge.value = 0;
        
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

        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }
        
        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            gauge.speedMultiplier = 1.0;
        }
        if (action) {
            this.world.addComponent(entityId, new Action());
        }
    }

    update(deltaTime) {
    }
}