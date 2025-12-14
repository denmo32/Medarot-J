/**
 * @file StateTransitionSystem.js
 * @description 状態遷移リクエストを処理するシステム。
 * イベント発行をコンポーネント生成へ置換。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState, Gauge, Action, ActiveEffects, Position } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import {
    TransitionStateRequest,
    ResetToCooldownRequest,
    HandleGaugeFullRequest,
    SetPlayerBrokenRequest,
    SnapToActionLineRequest,
    TransitionToCooldownRequest,
} from '../../components/CommandRequests.js';
import { ActionRequeueRequest } from '../../components/Requests.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { TeamID } from '../../../common/constants.js';
import { CONFIG } from '../../common/config.js';
import { GameEvents } from '../../../common/events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';

const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

export class StateTransitionSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        this._processTransitionStateRequests();
        this._processResetToCooldownRequests();
        this._processHandleGaugeFullRequests();
        this._processSetPlayerBrokenRequests();
        this._processSnapToActionLineRequests();
        this._processTransitionToCooldownRequests();
    }

    _processTransitionStateRequests() {
        const entities = this.getEntities(TransitionStateRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, TransitionStateRequest);
            const { targetId, newState } = request;
            const gameState = this.world.getComponent(targetId, GameState);
            if (gameState) {
                gameState.state = newState;

                const gauge = this.world.getComponent(targetId, Gauge);
                if (gauge) {
                    gauge.isActive = ACTIVE_GAUGE_STATES.has(newState);
                    if (newState === PlayerStateType.BROKEN) {
                        gauge.value = 0;
                        gauge.currentSpeed = 0;
                    }
                }

                if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
                    const reqEntity = this.world.createEntity();
                    this.world.addComponent(reqEntity, new SnapToActionLineRequest(targetId));
                }
            }
            this.world.destroyEntity(entityId);
        }
    }

    _processResetToCooldownRequests() {
        const entities = this.getEntities(ResetToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, ResetToCooldownRequest);
            const { targetId, options } = request;
            const { interrupted = false } = options;
            const parts = this.world.getComponent(targetId, Parts);
            if (parts?.head?.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            const gameState = this.world.getComponent(targetId, GameState);
            const gauge = this.world.getComponent(targetId, Gauge);

            if (gameState && gameState.state === PlayerStateType.GUARDING) {
                const activeEffects = this.world.getComponent(targetId, ActiveEffects);
                if (activeEffects) {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                }
            }
            
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.CHARGING));

            if (gauge) {
                if (interrupted) {
                    gauge.value = gauge.max - gauge.value;
                } else {
                    gauge.value = 0;
                }
                gauge.currentSpeed = 0;
                gauge.speedMultiplier = 1.0;
            }

            this.world.addComponent(targetId, new Action());
            this.world.destroyEntity(entityId);
        }
    }
    
    _processHandleGaugeFullRequests() {
        const entities = this.getEntities(HandleGaugeFullRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, HandleGaugeFullRequest);
            const { targetId } = request;
            const gameState = this.world.getComponent(targetId, GameState);
            if (gameState) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    // クールダウン完了 -> 行動選択準備完了
                    this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_SELECT));
                    
                    // イベント発行を廃止し、リクエストコンポーネントを生成
                    // ActionSelectionSystem がこれを検知して ActionSelectionPending を付与する
                    const req = this.world.createEntity();
                    this.world.addComponent(req, new ActionRequeueRequest(targetId));

                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    // チャージ完了 -> 行動実行準備完了
                    this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_EXECUTE));
                }
            }
            this.world.destroyEntity(entityId);
        }
    }

    _processSetPlayerBrokenRequests() {
        const entities = this.getEntities(SetPlayerBrokenRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, SetPlayerBrokenRequest);
            const { targetId } = request;
            
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.BROKEN));
            this.world.addComponent(targetId, new Action());

            // ログや他システムへの通知としてイベントは維持してもよいが、ロジック依存がある場合はコンポーネント化推奨
            // 現状はログ用途が主と思われるため維持
            const playerInfo = this.world.getComponent(targetId, PlayerInfo);
            if (playerInfo) {
                this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId, teamId: playerInfo.teamId });
            }
            this.world.destroyEntity(entityId);
        }
    }
    
    _processSnapToActionLineRequests() {
        const entities = this.getEntities(SnapToActionLineRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, SnapToActionLineRequest);
            const { targetId } = request;
            
            const position = this.world.getComponent(targetId, Position);
            const playerInfo = this.world.getComponent(targetId, PlayerInfo);

            if (position && playerInfo) {
                position.x = playerInfo.teamId === TeamID.TEAM1
                    ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                    : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
            this.world.destroyEntity(entityId);
        }
    }
    
    _processTransitionToCooldownRequests() {
        const entities = this.getEntities(TransitionToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, TransitionToCooldownRequest);
            const { targetId } = request;

            const parts = this.world.getComponent(targetId, Parts);
            if (parts?.head?.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            const gameState = this.world.getComponent(targetId, GameState);
            if (gameState && gameState.state === PlayerStateType.GUARDING) {
                this.world.addComponent(targetId, new Action());
                this.world.destroyEntity(entityId);
                continue;
            }

            const gauge = this.world.getComponent(targetId, Gauge);
            const action = this.world.getComponent(targetId, Action);

            if (action?.partKey && parts && gauge) {
                const usedPart = parts[action.partKey];
                if (usedPart) {
                    const modifier = EffectService.getSpeedMultiplierModifier(this.world, targetId, usedPart);
                    gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
                        might: usedPart.might,
                        success: usedPart.success,
                        factorType: 'cooldown',
                        modifier: modifier
                    });
                }
            } else if (gauge) {
                gauge.speedMultiplier = 1.0;
            }

            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.CHARGING));

            if (gauge) {
                gauge.value = 0;
                gauge.currentSpeed = 0;
            }

            this.world.addComponent(targetId, new Action());
            // this.world.emit(GameEvents.COOLDOWN_TRANSITION_COMPLETED, { entityId: targetId }); // 必要性が薄いため削除

            this.world.destroyEntity(entityId);
        }
    }
}