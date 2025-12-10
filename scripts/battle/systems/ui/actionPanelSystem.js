/**
 * @file ActionPanelSystem.js
 * @description UIの状態を監視し、DOMに反映する描画専用システム。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { UIManager } from '../../../../engine/ui/UIManager.js'; 
import { BattleUIManager } from '../../ui/BattleUIManager.js';
import { BattleUIState } from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        this.engineUIManager = this.world.getSingletonComponent(UIManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        this.battleUI = new BattleUIManager();

        this.on(GameEvents.UI_STATE_CHANGED, this.render.bind(this));

        // パネル本体へのクリックイベントを追加し、抽象的なUIイベントを発行する
        this.battleUI.dom.actionPanel.addEventListener('click', (e) => {
            // ボタン自身へのクリックは無視する (ボタンのクリックイベントはより具体的に処理されるべき)
            if (e.target.closest('button')) return;
            
            if (this.uiState && this.uiState.isPanelClickable && !this.uiState.isWaitingForAnimation) {
                this.world.emit(GameEvents.UI_CONFIRM);
            }
        });

        // ボタン群へのイベント委譲
        this.battleUI.dom.actionPanelButtons.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || button.disabled) return;
            
            this.world.emit(GameEvents.UI_CONFIRM);
        });

        this.battleUI.resetPanel(); // 初期化時に待機中表示に
    }
    
    update(deltaTime) {
        // UI_STATE_CHANGEDイベント駆動のため、毎フレームの更新は不要
    }

    render() {
        if (!this.uiState) return;

        if (this.uiState.isPanelVisible) {
            this.battleUI.showPanel();

            // テキストの更新
            this.battleUI.updatePanelText(
                this.uiState.ownerText, 
                this.uiState.titleText, 
                this.uiState.actorText
            );

            // コンテンツ（ボタンなど）の描画
            const context = this._createRenderContext();
            this.battleUI.renderContent(this.uiState.currentModalType, this.uiState.buttonsData, context);

            // クリック可能かどうかのCSSクラスを設定
            this.battleUI.setPanelClickable(this.uiState.isPanelClickable);

            // クリック可能インジケーターの更新
            if (this.uiState.isPanelClickable && !this.uiState.isWaitingForAnimation) {
                this.battleUI.showIndicator();
            } else {
                this.battleUI.hideIndicator();
            }

            // フォーカスとハイライトの更新
            this.resetHighlights();
            this.updateHighlightsAndFocus();
        } else {
            this.battleUI.resetPanel();
            this.resetHighlights();
        }
    }
    
    _createRenderContext() {
        return {
            emit: (eventName, detail) => this.world.emit(eventName, detail),
        };
    }

    updateHighlightsAndFocus() {
        // ボタンのフォーカス
        this.battleUI.updateAllButtonFocus(this.uiState.focusedButtonKey);

        // ターゲットのハイライト
        const focusedButton = this.uiState.buttonsData?.find(b => b.partKey === this.uiState.focusedButtonKey);
        if (focusedButton?.target?.targetId) {
            const targetDom = this.engineUIManager.getDOMElements(focusedButton.target.targetId);
            if (targetDom?.targetIndicatorElement) {
                targetDom.targetIndicatorElement.classList.add('active');
            }
        }
    }
    
    resetHighlights() {
        const allPlayerIds = this.getEntities(PlayerInfo);
        allPlayerIds.forEach(id => {
            const dom = this.engineUIManager.getDOMElements(id);
            if (dom?.targetIndicatorElement) {
                dom.targetIndicatorElement.classList.remove('active');
            }
        });
    }
}