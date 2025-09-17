// scripts/systems/viewSystem.js:
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
import { GamePhaseType, ModalType } from '../common/constants.js';

/**
 * ユーザーインタラクションの起点となり、UIの状態変化を監視するシステム。
 * アクションパネル（モーダル）の具体的なDOM操作はActionPanelSystemに分離されました。
 * このシステムは、UIイベント（ボタンクリックなど）をトリガーとして、
 * 他のシステム（ActionPanelSystem, GameFlowSystemなど）に処理を要求するイベントを発行する責務を持ちます。
 */
export class ViewSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(Components.GameContext);
        this.animationStyleElement = null; // 動的に生成したstyle要素への参照

        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'),
        };

        this.handlers = {
            gameStart: null,
        };

        this.bindWorldEvents();
        this.bindDOMEvents();
        this.injectAnimationStyles();
    }

    /**
     * このシステムが管理するDOMイベントリスナーと、動的に追加したスタイルシートを破棄します。
     */
    destroy() {
        if (this.handlers.gameStart) {
            this.dom.gameStartButton.removeEventListener('click', this.handlers.gameStart);
        }
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
        this.world.on(GameEvents.EXECUTION_ANIMATION_REQUESTED, this.onExecutionAnimationRequested.bind(this));
    }

    /**
     * このシステムが管理するDOM要素のイベントリスナーを登録します。
     */
    bindDOMEvents() {
        this.handlers.gameStart = () => {
            // ★変更: 直接モーダルを表示するのではなく、表示要求イベントを発行する
            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.START_CONFIRM });
        };
        this.dom.gameStartButton.addEventListener('click', this.handlers.gameStart);
    }

    /**
     * UIの状態をゲーム開始前の状態にリセットします。
     */
    resetView() {
        this.dom.gameStartButton.style.display = "flex";
    }

    /**
     * 毎フレーム実行され、ゲームフェーズに応じてUI要素の表示/非表示を制御します。
     */
    update(deltaTime) {
        this.dom.gameStartButton.style.display = this.context.phase === GamePhaseType.IDLE ? "flex" : "none";
    }

    /**
     * ActionSystemからの要求を受け、実行アニメーションを再生します。
     * @param {object} detail - { attackerId, targetId }
     */
    onExecutionAnimationRequested(detail) {
        const { attackerId, targetId } = detail;

        // アニメーションに必要なDOM要素が揃っているか最終確認
        const attackerDomRef = this.world.getComponent(attackerId, Components.DOMReference);
        const targetDomRef = this.world.getComponent(targetId, Components.DOMReference);
        if (!attackerDomRef || !targetDomRef || !attackerDomRef.iconElement || !targetDomRef.iconElement || !attackerDomRef.targetIndicatorElement) {
            console.warn('ViewSystem: Missing DOM elements for animation. Skipping.', detail);
            // アニメーションをスキップし、即座に完了イベントを発行してゲームを続行させる
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        // ゲージ進行などを一時停止させる
        this.world.emit(GameEvents.GAME_PAUSED);

        // 実際のアニメーション実行はRenderSystemに委譲する
        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, { attackerId, targetId });
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
