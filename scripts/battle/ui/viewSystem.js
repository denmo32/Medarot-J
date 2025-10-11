import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
import { BattlePhaseContext } from '../core/index.js'; // Import new context
import { GamePhaseType, ModalType } from '../common/constants.js';
import { UIManager } from './UIManager.js'; // ★新規: UIManagerをインポート
import { BaseSystem } from '../../core/baseSystem.js'; // ★追加: 継承元となるBaseSystemをインポート

/**
 * アニメーションと視覚効果の再生に特化したシステム。
 * 旧ViewSystemのアニメーション関連の責務を引き継ぎ、より専門化されています。
 * DOM要素の更新は行わず、アニメーションの開始、管理、完了通知を発行します。
 */
export class ViewSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager); // ★新規: UIManagerの参照を取得
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.animationStyleElement = null; // 動的に生成したstyle要素への参照

        this.dom = {
        };

        this.handlers = {
        };

        this.bindWorldEvents();
        this.bindDOMEvents();
        this.injectAnimationStyles();
    }

    /**
     * このシステムが管理するDOMイベントリスナーと、動的に追加したスタイルシートを破棄します。
     */
    destroy() {
        if (this.animationStyleElement) {
            document.head.removeChild(this.animationStyleElement);
            this.animationStyleElement = null;
        }
    }

    /**
     * Worldから発行されるイベントを購読します。
     */
    bindWorldEvents() {
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
        this.world.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        // ★変更: アニメーション実行要求を直接購読
        this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this));
    }

    /**
     * このシステムが管理するDOM要素のイベントリスナーを登録します。
     */
    bindDOMEvents() {
    }

    /**
     * ★新規: 戦闘開始アニメーションを表示します。
     */
    onShowBattleStartAnimation() {
        const battlefield = document.getElementById('battlefield');
        if (!battlefield) return;

        const textEl = document.createElement('div');
        textEl.className = 'battle-start-text';
        textEl.textContent = 'ロボトルファイト！';
        battlefield.appendChild(textEl);

        textEl.addEventListener('animationend', () => {
            textEl.remove();
            // アニメーション完了を通知
            this.world.emit(GameEvents.BATTLE_ANIMATION_COMPLETED);
        });
    }

    /**
     * UIの状態をゲーム開始前の状態にリセットします。
     */
    resetView() {
    }

    /**
     * 毎フレーム実行され、ゲームフェーズに応じてUI要素の表示/非表示を制御します。
     */
    update(deltaTime) {
    }

    /**
     * ★新規: 攻撃アニメーションを実行します (UISystemから移管)。
     * @param {object} detail - イベントペイロード { attackerId, targetId }
     */
    executeAttackAnimation(detail) {
        const { attackerId, targetId } = detail;
        const attackerDomElements = this.uiManager.getDOMElements(attackerId);
        const action = this.getCachedComponent(attackerId, Components.Action);

        // ターゲットがいない、または回復・援護行動の場合はアニメーションをスキップ
        if (!targetId || !attackerDomElements || (action && ['援護', '回復'].includes(action.type))) {
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        const targetDomElements = this.uiManager.getDOMElements(targetId);
        if (!attackerDomElements.iconElement || !targetDomElements?.iconElement) {
            console.warn('ViewSystem (Animation): Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        // ★新規: アニメーション開始時にゲームの進行を一時停止
        this.world.emit(GameEvents.GAME_PAUSED);
        
        const indicator = document.createElement('div');
        indicator.className = 'target-indicator';
        for (let i = 0; i < 4; i++) {
            const corner = document.createElement('div');
            corner.className = `corner corner-${i + 1}`;
            indicator.appendChild(corner);
        }
        document.body.appendChild(indicator);
        
        const attackerIcon = attackerDomElements.iconElement;
        const targetIcon = targetDomElements.iconElement;
        
        // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
        // ★修正: 意図的な遅延をsetTimeoutで追加する。
        // これにより、ブラウザがDOMのレイアウト計算を完了させるための時間を確保し、
        // getBoundingClientRect()が最新の正しい座標を返すことを保証する。
        setTimeout(() => {
            const attackerRect = attackerIcon.getBoundingClientRect();
            const targetRect = targetIcon.getBoundingClientRect();
            
            indicator.style.position = 'fixed';
            indicator.style.zIndex = '100';
            indicator.style.opacity = '1';
            
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
                indicator.remove();
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            });
        }, 100); // 100ミリ秒の遅延。レンダリングエンジンに十分な時間を与える。
        // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
    }

    /**
     * ターゲット表示用アニメーションのCSSを動的に<head>へ注入します。
     * ゲームリセット時に重複して注入されるのを防ぎます。
     */
    injectAnimationStyles() {
        const styleId = 'gemini-animation-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .target-indicator {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 70px; /* アイコンより広めのサイズに */
                height: 70px;
                transform: translate(-50%, -50%) scale(1); /* 初期スケールを追加 */
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease-in-out;
            }
            .target-indicator.active {
                opacity: 1;
            }
            .corner {
                position: absolute;
                width: 15px; /* 矢印のサイズを少し大きく */
                height: 15px;
                border-color: cyan;
                border-style: solid;
            }
            /* ↖ */
            .corner-1 { top: 0; left: 0; border-width: 4px 0 0 4px; }
            /* ↗ */
            .corner-2 { top: 0; right: 0; border-width: 4px 4px 0 0; }
            /* ↙ */
            .corner-3 { bottom: 0; left: 0; border-width: 0 0 4px 4px; }
            /* ↘ */
            .corner-4 { bottom: 0; right: 0; border-width: 0 4px 4px 0; }
            @keyframes radar-zoom-in {
                0% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                80%, 100% {
                    transform: translate(-50%, -50%) scale(0.6);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        this.animationStyleElement = style; // クリーンアップ用に参照を保持
    }
}