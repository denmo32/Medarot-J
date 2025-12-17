/**
 * @file MovementSystem.js
 * @description プレイヤーのフィールド上の位置更新を行うシステム。
 * IsAwaitingAnimationタグ（演出待機中）のハンドリングを追加し、意図しない帰還を防ぐ。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    Position, Gauge, 
    IsCharging, IsCooldown, IsReadyToExecute, IsGuarding, IsReadyToSelect, IsAwaitingAnimation
} from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { TeamID } from '../../../common/constants.js';
import { CONFIG } from '../../common/config.js';

export class MovementSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(PlayerInfo, Position, Gauge);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            const position = this.world.getComponent(entityId, Position);

            const progress = gauge.value / gauge.max;
            let positionXRatio;

            const isTeam1 = playerInfo.teamId === TeamID.TEAM1;
            const startLine = isTeam1 ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1 : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
            const actionLine = isTeam1 ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1 : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;

            if (this.world.getComponent(entityId, IsCharging)) {
                // アクションラインへ前進
                positionXRatio = startLine + (actionLine - startLine) * progress;
                if (isTeam1) {
                    positionXRatio = Math.min(positionXRatio, actionLine);
                } else {
                    positionXRatio = Math.max(positionXRatio, actionLine);
                }
            } else if (this.world.getComponent(entityId, IsCooldown)) {
                // スタートラインへ後退
                positionXRatio = actionLine + (startLine - actionLine) * progress;
                if (isTeam1) {
                    positionXRatio = Math.max(positionXRatio, startLine);
                } else {
                    positionXRatio = Math.min(positionXRatio, startLine);
                }
            } else if (
                this.world.getComponent(entityId, IsReadyToExecute) || 
                this.world.getComponent(entityId, IsGuarding) ||
                this.world.getComponent(entityId, IsAwaitingAnimation) // 追加: 演出待機中もアクションラインに留まる
            ) {
                // アクションライン待機
                positionXRatio = actionLine;
            } else {
                // それ以外（ReadySelect, Broken, CooldownComplete等）はスタートライン
                positionXRatio = startLine;
            }
            
            position.x = positionXRatio;
        }
    }
}