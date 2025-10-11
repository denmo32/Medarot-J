import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, Position, Gauge, GameState, Parts, Action } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { UIManager } from './UIManager.js';
import { GameEvents } from '../common/events.js'; // イベント定義をインポート

/**
 * @file DOM更新システム
 * @description ECSのコンポーネントの状態を、実際のDOM要素のスタイルや内容に反映させる責務を持つシステム。
 * アニメーションの再生はViewSystemが担当する。
 */
export class UISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // ★削除: アニメーションイベントの購読はViewSystemに移管
    }

    /**
     * 毎フレーム実行され、全エンティティのUIを最新の状態に更新します。
     * @param {number} deltaTime
     */
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, GameState, Parts);
        for (const entityId of entities) {
            this.updatePlayerUI(entityId);
        }
    }

    /**
     * 指定されたエンティティIDに対応するDOM要素を、現在のコンポーネント状態に基づいて更新します。
     * @param {number} entityId
     */
    updatePlayerUI(entityId) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements || !domElements.iconElement) return;

        const position = this.getCachedComponent(entityId, Position);
        const gameState = this.getCachedComponent(entityId, GameState);
        if (!position || !gameState) return;

        // 位置の更新
        domElements.iconElement.style.left = `${position.x * 100}%`;
        domElements.iconElement.style.top = `${position.y}%`;
        domElements.iconElement.style.transform = 'translate(-50%, -50%)';

        // 状態に応じたスタイル変更
        switch (gameState.state) {
            case PlayerStateType.SELECTED_CHARGING:
                domElements.iconElement.style.borderColor = '#f6ad55';
                break;
            case PlayerStateType.CHARGING:
                domElements.iconElement.style.borderColor = '#4fd1c5';
                break;
            default:
                domElements.iconElement.style.borderColor = '#718096';
                break;
        }

        domElements.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
        domElements.iconElement.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);

        // HPゲージの更新
        const parts = this.getCachedComponent(entityId, Parts);
        if (!parts) return;
        Object.entries(parts).forEach(([key, part]) => {
            const elements = domElements.partDOMElements[key];
            if (!elements || !part) return;
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

    // ★削除: executeAttackAnimationメソッドはViewSystemに移管されました。
}