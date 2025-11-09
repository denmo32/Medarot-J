import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, Position, Gauge, GameState, Parts, Action, ActiveEffects } from '../core/components/index.js';
import { PlayerStateType, EffectType, PartInfo } from '../common/constants.js';
import { UIManager } from './UIManager.js';
import { GameEvents } from '../common/events.js';
import { BattleContext } from '../core/index.js';

/**
 * @file DOM更新システム
 * @description ECSのコンポーネントの状態を、実際のDOM要素のスタイルや内容に反映させる責務を持つシステム。
 * アニメーションの再生はViewSystemが担当する。
 */
export class UISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // BattleContextへの参照を保持
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.world.on(GameEvents.HP_UPDATED, this.onHpUpdated.bind(this));
        // HPバーアニメーション完了イベントを購読し、破壊状態のUIを更新する
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpAnimationCompleted.bind(this));
    }

    /**
     * HP更新イベントのハンドラ。
     * @param {object} detail - HP_UPDATEDイベントのペイロード
     */
    onHpUpdated(detail) {
        // モーダル表示中はアニメーションをActionPanelSystemに任せるため、何もしない
        if (this.battleContext?.isPaused) {
            return;
        }

        const { entityId, partKey, newHp, maxHp } = detail;
        const domElements = this.uiManager.getDOMElements(entityId);
        const partDom = domElements?.partDOMElements?.[partKey];
        if (!partDom) return;

        const hpPercentage = (newHp / maxHp) * 100;
        partDom.bar.style.width = `${hpPercentage}%`;

        if (partDom.value) {
            partDom.value.textContent = `${newHp}/${maxHp}`;
        }
        
        // 破壊状態のクラス付与は onHpAnimationCompleted に移譲
        // 色の更新のみここで行う
        if (newHp === 0) {
            partDom.bar.style.backgroundColor = '#4a5568';
        } else {
            if (hpPercentage > 50) partDom.bar.style.backgroundColor = '#68d391';
            else if (hpPercentage > 20) partDom.bar.style.backgroundColor = '#f6e05e';
            else partDom.bar.style.backgroundColor = '#f56565';
        }
    }
    
    /**
     * HPバーのアニメーション完了後に、パーツおよび機体の破壊状態をUIに反映します。
     * @param {object} detail - HP_BAR_ANIMATION_COMPLETED イベントのペイロード { appliedEffects }
     */
    onHpAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            const domElements = this.uiManager.getDOMElements(effect.targetId);
            if (!domElements) continue;

            // パーツ破壊のUI更新
            if (effect.isPartBroken) {
                const partDom = domElements.partDOMElements?.[effect.partKey];
                if (partDom) {
                    partDom.container.classList.add('broken');
                }
            }

            // 機体機能停止のUI更新
            if (effect.isPlayerBroken) {
                 if (domElements.iconElement) {
                    domElements.iconElement.classList.add('broken');
                }
            }
        }
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
        const parts = this.getCachedComponent(entityId, Parts);
        if (!position || !gameState || !parts) return;

        domElements.iconElement.style.left = `${position.x * 100}%`;
        domElements.iconElement.style.top = `${position.y}%`;
        domElements.iconElement.style.transform = 'translate(-50%, -50%)';

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
        // 毎フレームの機能停止チェックを削除し、イベント駆動に変更

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
}