import { PlayerInfo, Position, Gauge, GameState, Parts, DOMReference } from '../core/components.js';
import { PlayerStateType, TeamID } from '../common/constants.js'; // TeamIDをインポート
import { BaseSystem } from '../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
export class RenderSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // ★改善: アニメーション要求イベントを直接購読
        // これにより、ViewSystemの仲介をなくし、システム間の連携をシンプルにします。
        this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this));
    }
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, Gauge, GameState, Parts, DOMReference);
        for (const entityId of entities) {
            this.updatePosition(entityId);
            this.updateInfoPanel(entityId);
        }
    }
    /**
     * Positionコンポーネントのデータに基づき、プレイヤーアイコンのDOM要素のスタイルを更新します。
     * 位置計算のロジックはMovementSystemに分離されました。
     * @param {number} entityId 
     */
    updatePosition(entityId) {
        const domRef = this.getCachedComponent(entityId, DOMReference);
        if (!domRef || !domRef.iconElement) return;

        // 位置と状態のコンポーネントを取得
        const position = this.getCachedComponent(entityId, Position);
        const gameState = this.getCachedComponent(entityId, GameState);
        if (!position || !gameState) return;

        // Positionコンポーネントのx座標をDOMのleftスタイルに適用
        domRef.iconElement.style.left = `${position.x * 100}%`;
        domRef.iconElement.style.top = `${position.y}%`;
        domRef.iconElement.style.transform = 'translate(-50%, -50%)';

        // ★新規: 状態に応じてアイコンの枠線の色を動的に変更
        switch (gameState.state) {
            case PlayerStateType.SELECTED_CHARGING: // チャージ中
                domRef.iconElement.style.borderColor = '#f6ad55'; // オレンジ
                break;
            case PlayerStateType.CHARGING: // クールダウン中
                domRef.iconElement.style.borderColor = '#4fd1c5'; // 水色
                break;
            default: // その他の状態
                domRef.iconElement.style.borderColor = '#718096'; // デフォルトのグレー
                break;
        }

        // 状態に応じたCSSクラスの切り替え
        domRef.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
        domRef.iconElement.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
    }
    updateInfoPanel(entityId) {
        const domRef = this.getCachedComponent(entityId, DOMReference);
        const parts = this.getCachedComponent(entityId, Parts);
        if (!domRef || !parts) return;
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
    /**
     * ★改善: 攻撃アニメーションを実行し、ゲームのポーズ/再開も管理します。
     * ActionSystem からイベントで直接要求され、アニメーションに関連する状態管理をこのシステム内で完結させます。
     * @param {object} detail - { attackerId, targetId }
     */
    executeAttackAnimation(detail) {
        const { attackerId, targetId } = detail;
        const attackerDomRef = this.world.getComponent(attackerId, DOMReference);
        const targetDomRef = this.world.getComponent(targetId, DOMReference);
        // DOM要素の存在確認
        if (!attackerDomRef || !targetDomRef || !attackerDomRef.iconElement || !targetDomRef.iconElement || !attackerDomRef.targetIndicatorElement) {
            console.warn('RenderSystem: Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        // ★新規: アニメーション開始時にゲームの進行を一時停止
        this.world.emit(GameEvents.GAME_PAUSED);

        const indicator = attackerDomRef.targetIndicatorElement;
        const attackerIcon = attackerDomRef.iconElement;
        const targetIcon = targetDomRef.iconElement;
        
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