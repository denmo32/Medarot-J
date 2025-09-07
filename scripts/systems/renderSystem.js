// scripts/systems/renderSystem.js:
import { PlayerInfo, Position, Gauge, GameState, Parts, DOMReference } from '../components.js';
import { PlayerStateType, TeamID } from '../constants.js'; // TeamIDをインポート
import { BaseSystem } from './baseSystem.js';
import { GameEvents } from '../events.js';
export class RenderSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // ★新規: 攻撃アニメーションの要求イベントを購読
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
     * ★新規: 攻撃アニメーションを実行するメソッド。
     * ViewSystem からイベントで要求され、実際のDOM操作とアニメーションを担当します。
     * @param {object} detail - { attackerId, targetId }
     */
    executeAttackAnimation(detail) {
        const { attackerId, targetId } = detail;
        const attackerDomRef = this.world.getComponent(attackerId, DOMReference);
        const targetDomRef = this.world.getComponent(targetId, DOMReference);
        // DOM要素の存在確認（ViewSystemでもチェックしているが、念のため二重チェック）
        if (!attackerDomRef || !targetDomRef || !attackerDomRef.iconElement || !targetDomRef.iconElement || !attackerDomRef.targetIndicatorElement) {
            console.warn('RenderSystem: Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }
        const indicator = attackerDomRef.targetIndicatorElement;
        const attackerIcon = attackerDomRef.iconElement;
        const targetIcon = targetDomRef.iconElement;
        // ★根本原因の修正: 親要素のtransformから逃れるため、アニメーション中だけインジケーターをbody直下に移動
        const originalParent = indicator.parentNode;
        document.body.appendChild(indicator);
        // ★タイミング問題の修正: ターゲットアイコンのCSS transition完了を待つため、少し遅延させる
        setTimeout(() => {
            // 座標計算
            const attackerRect = attackerIcon.getBoundingClientRect();
            const targetRect = targetIcon.getBoundingClientRect();
            // インジケーターを一時的に fixed ポジションにして、ページ全体でアニメーションさせる
            const originalStyle = {
                position: indicator.style.position,
                top: indicator.style.top,
                left: indicator.style.left,
                transform: indicator.style.transform,
                transition: indicator.style.transition,
                zIndex: indicator.style.zIndex
            };
            indicator.style.transition = 'none'; // JSアニメーション中はCSSのtransitionを無効化
            indicator.style.position = 'fixed';
            indicator.style.zIndex = '100';
            // アニメーション開始時にactiveクラスを追加して表示状態にする
            indicator.classList.add('active');
            // 攻撃者アイコンの中心座標を初期位置とする
            const startX = attackerRect.left + attackerRect.width / 2;
            const startY = attackerRect.top + attackerRect.height / 2;
            // ターゲットアイコンの中心座標を最終位置とする
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;
            // インジケーターの初期位置を設定 (fixedなのでビューポート基準)
            indicator.style.left = `${startX}px`;
            indicator.style.top = `${startY}px`;
            const animation = indicator.animate([
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0 }, // 初期スケールと不透明度
                { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1, offset: 0.2 }, // 拡大
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(1.5)`, opacity: 1, offset: 0.8 }, // 移動と維持
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 0, offset: 1 } // 縮小とフェードアウト
            ], {
                duration: 800, // 0.8秒
                easing: 'ease-in-out'
            });
            animation.finished.then(() => {
                // ★修正: インジケーターを元の親要素に戻す
                if(originalParent) originalParent.appendChild(indicator);
                // アニメーション後にインジケーターのスタイルを元に戻す
                indicator.style.position = originalStyle.position;
                indicator.style.top = originalStyle.top;
                indicator.style.left = originalStyle.left;
                indicator.style.transform = originalStyle.transform;
                indicator.style.transition = originalStyle.transition;
                indicator.style.zIndex = originalStyle.zIndex;
                indicator.classList.remove('active');
                // ActionSystemにアニメーション完了を通知
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            });
        }, 150); // 150msの遅延 (CSS transitionが0.1sのため)
    }
}