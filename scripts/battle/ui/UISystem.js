import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, Position, Gauge, GameState, Parts, Action, ActiveEffects } from '../core/components/index.js';
import { PlayerStateType, EffectType, PartInfo } from '../common/constants.js'; // ★ PartInfo をインポート
import { UIManager } from './UIManager.js';
import { GameEvents } from '../common/events.js'; // イベント定義をインポート
// ★新規: UIStateContextをインポートして、UIの状態（ポーズ中かなど）を確認できるようにする
import { UIStateContext } from '../core/index.js';

/**
 * @file DOM更新システム
 * @description ECSのコンポーネントの状態を、実際のDOM要素のスタイルや内容に反映させる責務を持つシステム。
 * アニメーションの再生はViewSystemが担当する。
 */
export class UISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // ★新規: UIStateContextへの参照を取得
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
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
        const parts = this.getCachedComponent(entityId, Parts); // ★ Partsをここで取得
        if (!position || !gameState || !parts) return;

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
        
        // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
        // ★修正: 機能停止の判定を gameState.state から parts.head.isBroken に変更
        domElements.iconElement.classList.toggle('broken', parts.head?.isBroken);
        // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---


        // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
        // ★修正: モーダル表示中はHPバーの更新をスキップする
        // これにより、宣言メッセージ表示中にHPバーが（アニメーションなしで）変化するのを防ぐ。
        // HPバーのアニメーションはActionPanelSystemが手動で適切なタイミングで実行する。
        if (this.uiStateContext && this.uiStateContext.isPausedByModal) {
            // ガードインジケーターなど、HP以外のUIは更新を続ける
        } else {
            // HPゲージの更新
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
        // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---

        // ★新規: ガードインジケーターの更新
        const activeEffects = this.getCachedComponent(entityId, ActiveEffects);
        const guardIndicator = domElements.guardIndicatorElement;

        if (activeEffects && guardIndicator) {
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);

            if (guardEffect && guardEffect.count > 0) {
                guardIndicator.textContent = `🛡${guardEffect.count}`;
                guardIndicator.style.display = 'block';
            } else {
                guardIndicator.style.display = 'none';
            }
        }
    }

    // ★削除: executeAttackAnimationメソッドはViewSystemに移管されました。
}