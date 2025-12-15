/**
 * @file ActionPanelSystem.js
 * @description UIの状態を監視し、DOMに反映する描画専用システム。
 * イベント駆動からポーリング駆動（Dirty Check）へ変更。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js'; // UI_CONFIRMなどは残るが、emitのみ
import { UIManager } from '../../../../engine/ui/UIManager.js'; 
import { BattleUIManager } from '../../ui/BattleUIManager.js';
import { BattleUIState } from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { UIInputState } from '../../components/States.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        this.engineUIManager = this.world.getSingletonComponent(UIManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        this.battleUI = new BattleUIManager();

        // ダーティチェック用キャッシュ
        this._lastRenderState = {
            isPanelVisible: false,
            ownerText: '',
            titleText: '',
            actorText: '',
            modalType: null,
            buttonsSignature: '', // ボタンデータの簡易ハッシュ代わり
            isPanelClickable: false,
            isWaiting: false,
            focusedKey: null
        };

        this._setupDomListeners();
        this.battleUI.resetPanel(); 
    }

    _setupDomListeners() {
        const emitConfirm = () => {
            if (this.uiState && this.uiState.isPanelClickable && !this.uiState.isWaitingForAnimation) {
                // UIInputSystemが処理するためのIntentを生成
                const stateEntity = this.world.createEntity();
                const uiInputState = new UIInputState();
                uiInputState.isActive = true;
                uiInputState.type = 'CONFIRM';
                this.world.addComponent(stateEntity, uiInputState);
            }
        };

        this.battleUI.dom.actionPanel.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            emitConfirm();
        });

        this.battleUI.dom.actionPanelButtons.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || button.disabled) return;
            emitConfirm();
        });
    }
    
    update(deltaTime) {
        if (!this.uiState) return;
        this.render();
    }

    render() {
        const state = this.uiState;
        const last = this._lastRenderState;
        
        // 変更検知
        const buttonsSig = state.buttonsData ? state.buttonsData.map(b => b.partKey + b.text).join('|') : '';
        const isDirty = 
            state.isPanelVisible !== last.isPanelVisible ||
            state.ownerText !== last.ownerText ||
            state.titleText !== last.titleText ||
            state.actorText !== last.actorText ||
            state.currentModalType !== last.modalType ||
            buttonsSig !== last.buttonsSignature ||
            state.isPanelClickable !== last.isPanelClickable ||
            state.isWaitingForAnimation !== last.isWaiting ||
            state.focusedButtonKey !== last.focusedKey;

        if (!isDirty) return;

        // キャッシュ更新
        last.isPanelVisible = state.isPanelVisible;
        last.ownerText = state.ownerText;
        last.titleText = state.titleText;
        last.actorText = state.actorText;
        last.modalType = state.currentModalType;
        last.buttonsSignature = buttonsSig;
        last.isPanelClickable = state.isPanelClickable;
        last.isWaiting = state.isWaitingForAnimation;
        last.focusedKey = state.focusedButtonKey;

        // 描画処理
        if (state.isPanelVisible) {
            this.battleUI.showPanel();

            this.battleUI.updatePanelText(
                state.ownerText, 
                state.titleText, 
                state.actorText
            );

            // コンテキスト: UIイベントはUIInputStateに変換されるため、ここでのemitは不要になったが
            // renderContentがemitを使う構造になっている場合は修正が必要。
            // 今回は BattleUIManager.js が emit を呼ぶ前提の構造なので、
            // 互換性のためダミーあるいは適切な変換関数を渡す。
            // ただし、renderContent 内で onclick に設定される処理は _setupDomListeners で包括的に
            // 処理される（イベント委譲）ため、個別の onclick は実は不要になる。
            // BattleUIManagerの実装を尊重しつつ、イベントはIntentへ。
            const context = {
                emit: (eventName, detail) => { /* Intentへの変換はDOMリスナー側で行うため、ここは空でも良いが、念のため */ }
            };
            
            this.battleUI.renderContent(state.currentModalType, state.buttonsData, context);

            this.battleUI.setPanelClickable(state.isPanelClickable);

            if (state.isPanelClickable && !state.isWaitingForAnimation) {
                this.battleUI.showIndicator();
            } else {
                this.battleUI.hideIndicator();
            }

            this.resetHighlights();
            this.updateHighlightsAndFocus();
        } else {
            this.battleUI.resetPanel();
            this.resetHighlights();
        }
    }
    
    updateHighlightsAndFocus() {
        this.battleUI.updateAllButtonFocus(this.uiState.focusedButtonKey);

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