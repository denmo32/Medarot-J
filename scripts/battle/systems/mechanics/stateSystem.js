import { System } from '../../../../engine/core/System.js';
import { Gauge, GameState, Action, ActiveEffects } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { EffectType, TeamID, PartInfo } from '../../../common/constants.js';
import { snapToActionLine } from '../../utils/positionUtils.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.REQUEST_STATE_TRANSITION, this.onStateTransitionRequested.bind(this));
        this.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.on(GameEvents.HP_UPDATED, this.onHpUpdated.bind(this));
        this.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
    }

    onStateTransitionRequested(detail) {
        const { entityId, newState } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) {
            gameState.state = newState;

            // 特定の状態遷移に伴う副作用もここで管理
            if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
                snapToActionLine(this.world, entityId);
            }
        }
    }

    onHpUpdated(detail) {
        const { entityId, partKey, newHp } = detail;
        
        // パーツ破壊判定
        const parts = this.world.getComponent(entityId, Parts);
        if (parts && parts[partKey]) {
            if (newHp === 0 && !parts[partKey].isBroken) {
                parts[partKey].isBroken = true;
                this.world.emit(GameEvents.PART_BROKEN, { entityId, partKey });
                
                // 頭部破壊ならプレイヤー破壊（機能停止）
                if (partKey === PartInfo.HEAD.key) {
                    this._setPlayerBroken(entityId);
                }
            }
        }
    }
    
    onPartBroken(detail) {
        const { entityId, partKey } = detail;
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
                this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId, options: {} });
            }
        }
    }

    _setPlayerBroken(entityId) {
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        if (gameState) {
            gameState.state = PlayerStateType.BROKEN;
        }
        if (gauge) {
            gauge.value = 0;
        }
        this.world.addComponent(entityId, new Action());

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
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.READY_SELECT });
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.READY_EXECUTE });
        }
    }
}