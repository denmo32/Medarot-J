import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, Position, Gauge, GameState, Parts } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { UIManager } from './UIManager.js';
import { GameEvents } from '../common/events.js'; // イベント定義をインポート

export class UISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // RenderSystem同様、アニメーションイベントを購読
        this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this));
    }

    update(deltaTime) {
        // UIの更新処理をここに記述します。
        // 例: DOM要素の取得と更新
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, Gauge, GameState, Parts);
        for (const entityId of entities) {
            this.updatePlayerUI(entityId);
        }
    }

    updatePlayerUI(entityId) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements || !domElements.iconElement) return;

        const position = this.getCachedComponent(entityId, Position);
        const gameState = this.getCachedComponent(entityId, GameState);
        if (!position || !gameState) return;

        // 位置の更新 (RenderSystemから移動)
        domElements.iconElement.style.left = `${position.x * 100}%`;
        domElements.iconElement.style.top = `${position.y}%`;
        domElements.iconElement.style.transform = 'translate(-50%, -50%)';

        // 状態に応じたスタイル変更 (RenderSystemから移動)
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

        // HPゲージの更新 (RenderSystemから移動)
        const parts = this.getCachedComponent(entityId, Parts);
        if (!parts) return;
        Object.entries(parts).forEach(([key, part]) => {
            const elements = domElements.partDOMElements[key];
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

    // RenderSystemからメソッドを移動
    executeAttackAnimation(detail) {
        const { attackerId, targetId } = detail;
        const attackerDomElements = this.uiManager.getDOMElements(attackerId);
        const targetDomElements = this.uiManager.getDOMElements(targetId);
        // DOM要素の存在確認
        if (!attackerDomElements || !targetDomElements || !attackerDomElements.iconElement || !targetDomElements.iconElement || !attackerDomElements.targetIndicatorElement) {
            console.warn('UISystem: Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        // ★新規: アニメーション開始時にゲームの進行を一時停止
        this.world.emit(GameEvents.GAME_PAUSED);

        const indicator = attackerDomElements.targetIndicatorElement;
        const attackerIcon = attackerDomElements.iconElement;
        const targetIcon = targetDomElements.iconElement;
        
        const originalParent = indicator.parentNode;
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            const attackerRect = attackerIcon.getBoundingClientRect();
            const targetRect = targetIcon.getBoundingClientRect();
            
            const originalStyle = {
                position: indicator.style.position,
                top: indicator.style.top,
                left: indicator.style.left,
                transform: indicator.style.transform,
                transition: indicator.style.transition,
                zIndex: indicator.style.zIndex
            };
            indicator.style.transition = 'none'; 
            indicator.style.position = 'fixed';
            indicator.style.zIndex = '100';
            
            indicator.classList.add('active');
            
            const startX = attackerRect.left + attackerRect.width / 2;
            const startY = attackerRect.top + attackerRect.height / 2;
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;
            
            indicator.style.left = `${startX}px`;
            indicator.style.top = `${startY}px`;
            
            const animation = indicator.animate([
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0 },
                { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1, offset: 0.2 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(1.5)`, opacity: 1, offset: 0.5 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 1, offset: 0.65 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(2.0)`, opacity: 1, offset: 0.8 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 0, offset: 1 }
            ], {
                duration: 1200, 
                easing: 'ease-in-out'
            });
            animation.finished.then(() => {
                if(originalParent) originalParent.appendChild(indicator);
                
                indicator.style.position = originalStyle.position;
                indicator.style.top = originalStyle.top;
                indicator.style.left = originalStyle.left;
                indicator.style.transform = originalStyle.transform;
                indicator.style.transition = originalStyle.transition;
                indicator.style.zIndex = originalStyle.zIndex;
                indicator.classList.remove('active');
                
                // ActionSystemにアニメーション完了を通知
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
                // ★修正: アニメーション完了時にゲームを再開しない。
                // ゲームの再開は、後続のメッセージモーダルが全て閉じられた後、ActionPanelSystemによって行われる。
                // this.world.emit(GameEvents.GAME_RESUMED);
            });
        }, 110);
    }
}