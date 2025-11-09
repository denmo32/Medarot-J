import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType, EffectScope } from '../common/constants.js';
import { InputManager } from '../../core/InputManager.js';
import { UIManager } from './UIManager.js';
import { createModalHandlers } from './modalHandlers.js';

/**
 * @class ActionPanelSystem
 * @description UIのモーダル（アクションパネル）の表示とインタラクションを管理するシステム。
 * このシステムは、全てのモーダル表示要求をキューで管理し、メッセージシーケンスの順次表示や
 * アニメーションとの同期を制御する、UIフローの中心的な役割を担います。
 */
export class ActionPanelSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = new InputManager();
        
        // --- DOM References ---
        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        // --- State ---
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;
        this.focusedButtonKey = null; // SELECTIONモーダル固有の状態

        // --- New State for Queue and Sequence Management ---
        this.modalQueue = [];           // 表示待ちモーダルのキュー
        this.isProcessingQueue = false; // キュー処理中フラグ
        this.currentMessageSequence = []; // 現在表示中のメッセージシーケンス
        this.currentSequenceIndex = 0;    // シーケンスの現在位置
        this.isWaitingForAnimation = false; // アニメーション完了待ちフラグ

        // --- Event Handlers ---
        this.boundHandlePanelClick = null;

        // モーダルハンドラの定義を外部のファクトリ関数に移譲
        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();

        // 初期状態ではパネルの内容をリセットする
        this.hideActionPanel();
    }
    
    /**
     * このシステムが管理するDOMイベントリスナーを全て破棄します。
     */
    destroy() {
        if (this.boundHandlePanelClick) {
            this.dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
        }
    }
    
    /**
     * Worldから発行されるイベントを購読します。
     */
    bindWorldEvents() {
        // SHOW_MODALはキューに追加する役割に変更
        this.world.on(GameEvents.SHOW_MODAL, this.queueModal.bind(this));
        // HIDE_MODALは現在のモーダルを強制的に閉じる役割
        this.world.on(GameEvents.HIDE_MODAL, this.hideActionPanel.bind(this));
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    /**
     * 毎フレームの更新処理。キュー処理とキーボード入力を担当します。
     */
    update(deltaTime) {
        // --- 1. キュー処理 ---
        // キュー処理はイベント駆動で即時実行されるため、updateでのポーリングは不要

        // --- 2. 入力処理 ---
        // モーダルが表示されていて、アニメーション待ちでなければ入力を処理
        if (!this.currentHandler || this.isWaitingForAnimation) return;

        // キー入力を現在のモーダルハンドラに委譲する
        if (this.currentHandler.handleNavigation) {
            if (this.inputManager.wasKeyJustPressed('ArrowUp')) this.currentHandler.handleNavigation(this, 'arrowup');
            if (this.inputManager.wasKeyJustPressed('ArrowDown')) this.currentHandler.handleNavigation(this, 'arrowdown');
            if (this.inputManager.wasKeyJustPressed('ArrowLeft')) this.currentHandler.handleNavigation(this, 'arrowleft');
            if (this.inputManager.wasKeyJustPressed('ArrowRight')) this.currentHandler.handleNavigation(this, 'arrowright');
        }
        if (this.inputManager.wasKeyJustPressed('z')) {
            this.currentHandler.handleConfirm?.(this, this.currentModalData);
        }
        if (this.inputManager.wasKeyJustPressed('x')) {
            this.currentHandler.handleCancel?.(this, this.currentModalData);
        }
    }

    /**
     * モーダル表示要求をキューに追加します。
     * @param {object} detail - SHOW_MODALイベントのペイロード
     */
    queueModal(detail) {
        this.modalQueue.push(detail);
        // キュー処理中でなければ、即座に処理を開始する
        if (!this.isProcessingQueue) {
            // updateループを待たずにキュー処理を即座に開始
            this._processModalQueue();
        }
    }
    
    /**
     * モーダルキューの先頭から要求を取り出し、表示処理を開始します。
     * @private
     */
    _processModalQueue() {
        // シンプルなキュー処理ロジックに
        if (this.modalQueue.length > 0) {
            this.isProcessingQueue = true;
            const modalRequest = this.modalQueue.shift();
            this._showModal(modalRequest);
        } else {
            // 念のため、キューが空ならフラグをリセット
            this.isProcessingQueue = false;
        }
    }
    
    /**
     * 実際にモーダルを画面に表示する内部メソッド。
     * @private
     */
    _showModal({ type, data, messageSequence = [] }) {
        this.currentHandler = this.modalHandlers[type];
        if (!this.currentHandler) {
            console.warn(`ActionPanelSystem: No handler found for modal type "${type}"`);
            this.isProcessingQueue = false; // 処理を終了して次のキューに進めるようにする
            this._processModalQueue();
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        this.currentModalType = type;
        this.currentModalData = data;
        
        // メッセージシーケンスをセットアップ。シーケンスがなければ、単一の空メッセージを持つシーケンスとして扱う
        this.currentMessageSequence = (messageSequence.length > 0) ? messageSequence : [{}]; // 空ステップでハンドラの表示ロジックを起動
        this.currentSequenceIndex = 0;
        
        // 最初のメッセージシーケンスを表示
        this._displayCurrentSequenceStep();
    }
    
    /**
     * メッセージシーケンスの次のステップに進みます。confirmハンドラから呼び出されます。
     */
    proceedToNextSequence() {
        if (this.isWaitingForAnimation) return; // アニメーション中は進行しない

        this.currentSequenceIndex++;
        if (this.currentSequenceIndex < this.currentMessageSequence.length) {
            this._displayCurrentSequenceStep();
        } else {
            // EXECUTION_RESULT モーダル完了時に、UIに依存しない抽象的なイベントを発行する
            if (this.currentModalType === ModalType.EXECUTION_RESULT) {
                this.world.emit(GameEvents.COMBAT_RESOLUTION_DISPLAYED, {
                    attackerId: this.currentModalData?.attackerId
                });
            }

            // シーケンス完了時の処理を汎用化
            // どのモーダルが完了したかを、新しいUIイベントで通知する
            this.world.emit(GameEvents.MODAL_SEQUENCE_COMPLETED, {
                modalType: this.currentModalType,
                originalData: this.currentModalData,
            });

            // 攻撃宣言モーダルの場合、次のモーダル(結果表示)を待つためUIはそのまま
            if (this.currentModalType === ModalType.ATTACK_DECLARATION) {
                // isProcessingQueueをfalseにして、次のキュー(結果表示モーダル)を処理できるようにする
                this.isProcessingQueue = false;
                // 次のキューを処理
                this._processModalQueue();
            } else {
                // それ以外のモーダルは完了後にパネルを隠す
                this.hideActionPanel();
            }
        }
    }

    /**
     * 現在のシーケンスインデックスに基づいて、メッセージ表示やアニメーション待機を行います。
     * @private
     */
    _displayCurrentSequenceStep() {
        const currentStep = this.currentMessageSequence[this.currentSequenceIndex] || {};
        
        // 1. アニメーション待機ステップか？
        if (currentStep.waitForAnimation) {
            this.isWaitingForAnimation = true;
            this.dom.actionPanel.classList.remove('clickable');
            this.dom.actionPanelIndicator.classList.add('hidden');
            // ViewSystemにHPバーのアニメーション再生を要求
            this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { effects: this.currentModalData.appliedEffects || [] });
            return;
        }
        
        // 2. メッセージ表示またはUI構築ステップ
        this.isWaitingForAnimation = false;
        
        this.resetPanelDOM();
        const handler = this.currentHandler;
        const displayData = { ...this.currentModalData, currentMessage: currentStep };

        // コンテンツを設定
        this.dom.actionPanelOwner.textContent = handler.getOwnerName?.(displayData) || '';
        this.dom.actionPanelTitle.textContent = handler.getTitle?.(displayData) || '';
        this.dom.actionPanelActor.innerHTML = handler.getActorName?.(displayData) || handler.getActorName?.(this.currentModalData) || ''; // 従来のdataもフォールバック
        this.dom.actionPanelButtons.innerHTML = handler.getContentHTML?.(displayData, this) || '';

        handler.setupEvents?.(this, this.dom.actionPanelButtons, displayData);

        if (handler.isClickable) {
            this.dom.actionPanelIndicator.classList.remove('hidden');
            this.dom.actionPanel.classList.add('clickable');
            if (!this.boundHandlePanelClick) {
                this.boundHandlePanelClick = () => handler.handleConfirm?.(this, this.currentModalData);
            }
            this.dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
        }
        handler.init?.(this, displayData);
    }
    
    /**
     * アクションパネルを非表示にし、関連する状態をリセットします。
     */
    hideActionPanel() {
        if (this.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.currentModalType });
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        this.isWaitingForAnimation = false;
        this.isProcessingQueue = false;

        this.resetPanelDOM();
        this.resetHighlightsAndFocus();
        
        // パネルを閉じた直後に、キューに次のモーダルがあれば処理を開始
        this._processModalQueue();
    }

    /**
     * ViewSystemからのHPバーアニメーション完了通知を受け取るハンドラ。
     */
    onHpBarAnimationCompleted(detail) {
        if (this.isWaitingForAnimation) {
            this.isWaitingForAnimation = false;
            // アニメーションが完了したので、シーケンスの次のステップへ
            this.proceedToNextSequence();
        }
    }

    /**
     * パネルのDOM要素を初期状態にリセットします。
     */
    resetPanelDOM() {
        const { dom } = this;
        dom.actionPanelOwner.textContent = '';
        dom.actionPanelTitle.textContent = '';
        dom.actionPanelActor.innerHTML = '待機中...';
        dom.actionPanelButtons.innerHTML = '';
        dom.actionPanelIndicator.classList.add('hidden');
        dom.actionPanel.classList.remove('clickable');
        if (this.boundHandlePanelClick) {
            dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
            this.boundHandlePanelClick = null;
        }
    }
    
    /**
     * 全てのハイライトとフォーカスをリセットします。
     */
    resetHighlightsAndFocus() {
        const allPlayerIds = this.world.getEntitiesWith(Components.PlayerInfo);
        allPlayerIds.forEach(id => {
            const dom = this.uiManager.getDOMElements(id);
            if (dom?.targetIndicatorElement) dom.targetIndicatorElement.classList.remove('active');
        });

        if (this.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this.focusedButtonKey = null;
    }
}