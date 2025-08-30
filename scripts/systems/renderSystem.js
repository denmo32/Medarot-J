// scripts/systems/renderSystem.js:

import { PlayerInfo, Position, Gauge, GameState, Parts, DOMReference } from '../components.js';
import { PlayerStateType, TeamID } from '../constants.js'; // TeamIDをインポート
import { CONFIG } from '../config.js'; // ★追加: 設定ファイルをインポート

export class RenderSystem {
    constructor(world) {
        this.world = world;
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, Gauge, GameState, Parts, DOMReference);

        for (const entityId of entities) {
            this.updatePosition(entityId);
            this.updateInfoPanel(entityId);
        }
    }

    updatePosition(entityId) {
        const domRef = this.world.getComponent(entityId, DOMReference);
        if (!domRef.iconElement) return;

        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const position = this.world.getComponent(entityId, Position);

        const progress = gauge.value / gauge.max;
        let positionXRatio;

        // 各チームのアクションラインの位置を定義
        const ACTION_LINE_TEAM1 = 0.45; // 45%
        const ACTION_LINE_TEAM2 = 0.55; // 55%

        const isTeam1 = playerInfo.teamId === TeamID.TEAM1;
        const actionLine = isTeam1 ? ACTION_LINE_TEAM1 : ACTION_LINE_TEAM2;
        // ★変更: ホームポジションを見切れなくするため、マージンを適用
        const startLine = isTeam1 ? CONFIG.HOME_MARGIN : 1 - CONFIG.HOME_MARGIN;

        switch(gameState.state) {
            case PlayerStateType.SELECTED_CHARGING: // 自陣 -> アクションライン
                // チーム1: 0 -> 0.4, チーム2: 1 -> 0.6
                positionXRatio = startLine + (actionLine - startLine) * progress;
                break;
            case PlayerStateType.CHARGING: // アクションライン -> 自陣
                // チーム1: 0.4 -> 0, チーム2: 0.6 -> 1
                positionXRatio = actionLine + (startLine - actionLine) * progress;
                break;
            case PlayerStateType.READY_EXECUTE:
                positionXRatio = actionLine;
                break;
            case PlayerStateType.COOLDOWN_COMPLETE:
            case PlayerStateType.READY_SELECT:
                positionXRatio = startLine;
                break;
            default:
                 positionXRatio = position.x; // 状態が変わらない場合は現在の位置を維持
                 break;
        }
        
        position.x = positionXRatio;

        domRef.iconElement.style.left = `${position.x * 100}%`;
        domRef.iconElement.style.top = `${position.y}%`;
        domRef.iconElement.style.transform = 'translate(-50%, -50%)';

        const isReadyForSelection = gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.COOLDOWN_COMPLETE;
        domRef.iconElement.classList.toggle('ready-select', isReadyForSelection);
        domRef.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
        domRef.iconElement.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
    }

    updateInfoPanel(entityId) {
        const domRef = this.world.getComponent(entityId, DOMReference);
        const parts = this.world.getComponent(entityId, Parts);

        Object.entries(parts).forEach(([key, part]) => {
            const elements = domRef.partDOMElements[key];
            if (!elements) return;

            const hpPercentage = (part.hp / part.maxHp) * 100;
            elements.bar.style.width = `${hpPercentage}%`;
            elements.container.classList.toggle('broken', part.isBroken);

            if (part.isBroken) {
                elements.bar.style.backgroundColor = '#4a5568';
            } else {
                if (hpPercentage > 50) elements.bar.style.backgroundColor = '#68d391';
                else if (hpPercentage > 20) elements.bar.style.backgroundColor = '#f6e05e';
                else elements.bar.style.backgroundColor = '#f56565';
            }
        });
    }
}
