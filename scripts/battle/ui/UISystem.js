import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, Position, Gauge, GameState, Parts, Action, ActiveEffects } from '../core/components/index.js';
import { PlayerStateType, EffectType, PartInfo } from '../common/constants.js';
import { UIManager } from './UIManager.js';
import { GameEvents } from '../common/events.js';
// [リファクタリング] UIStateContext の代わりに BattleContext を使用します。
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
        // [リファクタリング] BattleContextへの参照を保持します。
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.world.on(GameEvents.HP_UPDATED, this.onHpUpdated.bind(this));
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

        if (newHp === 0) {
            partDom.container.classList.add('broken');
            partDom.bar.style.backgroundColor = '#4a5568';
        } else {
            partDom.container.classList.remove('broken');
            if (hpPercentage > 50) partDom.bar.style.backgroundColor = '#68d391';
            else if (hpPercentage > 20) partDom.bar.style.backgroundColor = '#f6e05e';
            else partDom.bar.style.backgroundColor = '#f56565';
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
        domElements.iconElement.classList.toggle('broken', parts.head?.isBroken);

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