import { System } from '../../../../engine/core/System.js';
import { Gauge, GameState, Action, ActiveEffects } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { EffectType, TeamID, PartInfo } from '../../../common/constants.js';
import { snapToActionLine } from '../../utils/positionUtils.js';

// ゲージを加算すべき状態のリスト
const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.REQUEST_STATE_TRANSITION, this.onStateTransitionRequested.bind(this));
        this.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
        this.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    onStateTransitionRequested(detail) {
        const { entityId, newState } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) {
            gameState.state = newState;

            // ゲージのアクティブ状態を更新
            const gauge = this.world.getComponent(entityId, Gauge);
            if (gauge) {
                gauge.isActive = ACTIVE_GAUGE_STATES.has(newState);
            }

            // 特定の状態遷移に伴う副作用
            if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
                snapToActionLine(this.world, entityId);
            }
            
            if (newState === PlayerStateType.BROKEN) {
                if (gauge) gauge.value = 0;
            }
        }
    }

    onPartBroken(detail) {
        const { entityId, partKey } = detail;
        
        // 頭部破壊ならプレイヤー破壊（機能停止）
        if (partKey === PartInfo.HEAD.key) {
            this._setPlayerBroken(entityId);
        }

        const gameState = this.world.getComponent(entityId, GameState);
        // ガード中のパーツが破壊されたかチェック
        if (gameState?.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (!activeEffects) return;

            const isGuardPartBroken = activeEffects.effects.some(
                effect => effect.type === EffectType.APPLY_GUARD && effect.partKey === partKey
            );

            if (isGuardPartBroken) {
                this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
                // ガード破壊時はクールダウンへ（Sequence外での発生も想定してイベント経由）
                this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId, options: {} });
            }
        }
    }
    
    onGuardBroken(detail) {
        // メッセージ表示などは他で行う
    }

    _setPlayerBroken(entityId) {
        // State遷移イベントを発行して、GaugeSystemの制御(isActive)もonStateTransitionRequestedに任せる
        this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.BROKEN });

        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const action = this.world.getComponent(entityId, Action);
        
        // アクションリセット
        if (action) {
            this.world.addComponent(entityId, new Action());
        }

        if (playerInfo) {
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId, teamId: playerInfo.teamId });
        }
    }

    onCombatSequenceResolved(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            if (effect.type === EffectType.APPLY_GUARD) {
                this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, {
                    entityId: attackerId,
                    newState: PlayerStateType.GUARDING
                });
            }
        }
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.READY_SELECT });
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.READY_EXECUTE });
        }
    }
}