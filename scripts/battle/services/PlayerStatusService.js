/**
 * @file PlayerStatusService.js
 * @description プレイヤーの状態遷移とそれに伴う副作用（ゲージ制御、位置補正など）を一元管理するサービス。
 */
import { GameEvents } from '../../common/events.js';
import { Gauge, GameState, Action } from '../components/index.js';
import { PlayerInfo } from '../../components/index.js';
import { PlayerStateType } from '../common/constants.js';
import { snapToActionLine } from '../utils/positionUtils.js';

// ゲージを加算すべき状態のリスト
const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

export class PlayerStatusService {
    /**
     * エンティティの状態を遷移させる
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} newState PlayerStateType
     */
    static transitionTo(world, entityId, newState) {
        const gameState = world.getComponent(entityId, GameState);
        if (!gameState) return;

        // 状態更新
        gameState.state = newState;

        // 副作用1: ゲージのアクティブ状態更新
        const gauge = world.getComponent(entityId, Gauge);
        if (gauge) {
            gauge.isActive = ACTIVE_GAUGE_STATES.has(newState);
            
            // 破壊状態ならゲージリセット
            if (newState === PlayerStateType.BROKEN) {
                gauge.value = 0;
                gauge.currentSpeed = 0;
            }
        }

        // 副作用2: 位置スナップ（アクションラインへの移動）
        if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
            snapToActionLine(world, entityId);
        }
    }

    /**
     * プレイヤーを機能停止（破壊）状態にする
     * @param {World} world 
     * @param {number} entityId 
     */
    static setPlayerBroken(world, entityId) {
        this.transitionTo(world, entityId, PlayerStateType.BROKEN);

        const playerInfo = world.getComponent(entityId, PlayerInfo);
        const action = world.getComponent(entityId, Action);
        
        // アクションリセット
        if (action) {
            world.addComponent(entityId, new Action());
        }

        if (playerInfo) {
            world.emit(GameEvents.PLAYER_BROKEN, { entityId, teamId: playerInfo.teamId });
        }
    }

    /**
     * ゲージ満タン時の状態遷移を処理する
     * @param {World} world 
     * @param {number} entityId 
     */
    static handleGaugeFull(world, entityId) {
        const gameState = world.getComponent(entityId, GameState);
        if (!gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            this.transitionTo(world, entityId, PlayerStateType.READY_SELECT);
            world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            this.transitionTo(world, entityId, PlayerStateType.READY_EXECUTE);
        }
    }
}