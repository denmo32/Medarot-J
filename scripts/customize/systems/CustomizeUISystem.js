/**
 * @file CustomizeUISystem.js
 * @description カスタマイズ画面のUI制御システム。
 * イベントリスナーをコンポーネントポーリングへ変更。
 */
import { System } from '../../../engine/core/System.js';
import { PartKeyToInfoMap } from '../../common/constants.js';
import { EquipSlotType } from '../common/constants.js';
import { CustomizeState } from '../components/CustomizeState.js';
import { CustomizeUIManager } from '../ui/CustomizeUIManager.js';
import { SceneChangeRequest } from '../../components/SceneRequests.js';
import { 
    CustomizeNavigateRequest, 
    CustomizeConfirmRequest, 
    CustomizeCancelRequest,
    EquipPartRequest,
    EquipMedalRequest,
    ItemEquippedTag
} from '../components/CustomizeRequests.js';

const focusTransitionMap = {
    MEDAROT_SELECT: { confirm: 'EQUIP_PANEL', cancel: 'EXIT' },
    EQUIP_PANEL: { confirm: 'ITEM_LIST', cancel: 'MEDAROT_SELECT' },
    ITEM_LIST: { cancel: 'EQUIP_PANEL' },
};

export class CustomizeUISystem extends System {
    constructor(world, gameDataManager) {
        super(world);
        this.dataManager = gameDataManager;
        this.uiState = this.world.getSingletonComponent(CustomizeState);
        this.uiManager = new CustomizeUIManager();

        this.equipSlots = this.uiManager.equipSlots;
        
        this.currentPartListData = [];
        this.currentMedalListData = [];

        // 初期表示
        this.uiManager.show();
        this.renderAll();
    }
    
    destroy() {
        this.uiManager.hide();
        super.destroy();
    }

    update(deltaTime) {
        // リクエスト処理
        this._processNavigation();
        this._processConfirm();
        this._processCancel();
        this._processEquippedTags();
    }

    _processNavigation() {
        const requests = this.getEntities(CustomizeNavigateRequest);
        for (const id of requests) {
            const req = this.world.getComponent(id, CustomizeNavigateRequest);
            this.handleNavigation(req.direction);
            this.world.destroyEntity(id);
        }
    }

    _processConfirm() {
        const requests = this.getEntities(CustomizeConfirmRequest);
        for (const id of requests) {
            this.handleConfirm();
            this.world.destroyEntity(id);
        }
    }

    _processCancel() {
        const requests = this.getEntities(CustomizeCancelRequest);
        for (const id of requests) {
            this.handleCancel();
            this.world.destroyEntity(id);
        }
    }

    _processEquippedTags() {
        const tags = this.getEntities(ItemEquippedTag);
        if (tags.length > 0) {
            this.onItemEquipped();
            for (const id of tags) this.world.destroyEntity(id);
        }
    }

    handleNavigation(direction) {
        let stateChanged = false;

        switch (this.uiState.focus) {
            case 'MEDAROT_SELECT':
                stateChanged = this._handleMedarotSelectNav(direction);
                break;
            case 'EQUIP_PANEL':
                stateChanged = this._handleEquipPanelNav(direction);
                break;
            case 'ITEM_LIST':
                stateChanged = this._handleItemListNav(direction);
                break;
        }

        if (stateChanged) {
            this.renderAll();
        }
    }

    _handleMedarotSelectNav(direction) {
        const verticalMove = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
        if (verticalMove === 0) return false;

        const medarotCount = this.dataManager.gameData.playerMedarots.length;
        this.uiState.selectedMedarotIndex = (this.uiState.selectedMedarotIndex + verticalMove + medarotCount) % medarotCount;
        this.uiState.selectedEquipIndex = 0;
        return true;
    }

    _handleEquipPanelNav(direction) {
        if (direction === 'up' || direction === 'down') {
            const move = direction === 'down' ? 1 : -1;
            const slotCount = this.equipSlots.length;
            this.uiState.selectedEquipIndex = (this.uiState.selectedEquipIndex + move + slotCount) % slotCount;
            return true;
        } else if (direction === 'left' || direction === 'right') {
            this.changeEquippedItem(direction);
            return false;
        }
        return false;
    }

    _handleItemListNav(direction) {
        const verticalMove = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
        if (verticalMove === 0) return false;

        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const listData = selectedSlotType === EquipSlotType.MEDAL ? this.currentMedalListData : this.currentPartListData;
        
        if (listData.length > 0) {
            if (selectedSlotType === EquipSlotType.MEDAL) {
                this.uiState.selectedMedalListIndex = (this.uiState.selectedMedalListIndex + verticalMove + listData.length) % listData.length;
            } else {
                this.uiState.selectedPartListIndex = (this.uiState.selectedPartListIndex + verticalMove + listData.length) % listData.length;
            }
            return true;
        }
        return false;
    }

    handleConfirm() {
        const currentFocus = this.uiState.focus;
        const nextFocus = focusTransitionMap[currentFocus]?.confirm;

        if (nextFocus) {
            this.uiState.focus = nextFocus;
            if (nextFocus === 'ITEM_LIST') {
                this.uiState.selectedPartListIndex = 0;
                this.uiState.selectedMedalListIndex = 0;
            }
            this.renderAll();
        } else if (currentFocus === 'ITEM_LIST') {
            this.triggerEquipAction();
        }
    }
    
    handleCancel() {
        const currentFocus = this.uiState.focus;
        const nextFocus = focusTransitionMap[currentFocus]?.cancel;

        if (nextFocus === 'EXIT') {
            // シーン遷移リクエスト発行
            const req = this.world.createEntity();
            this.world.addComponent(req, new SceneChangeRequest('map', { restoreMenu: true }));
        } else if (nextFocus) {
            this.uiState.focus = nextFocus;
            this.renderAll();
        }
    }
    
    triggerEquipAction() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const medarotIndex = this.uiState.selectedMedarotIndex;

        const req = this.world.createEntity();

        if (selectedSlotType === EquipSlotType.MEDAL) {
            const selectedMedal = this.currentMedalListData[this.uiState.selectedMedalListIndex];
            this.world.addComponent(req, new EquipMedalRequest(medarotIndex, selectedMedal?.id));
        } else {
            const selectedPart = this.currentPartListData[this.uiState.selectedPartListIndex];
            this.world.addComponent(req, new EquipPartRequest(medarotIndex, selectedSlotType, selectedPart?.id));
        }
    }

    onItemEquipped() {
        if (this.uiState.focus !== 'EQUIP_PANEL') {
            this.uiState.focus = 'EQUIP_PANEL';
        }
        this.renderAll();
    }
    
    changeEquippedItem(direction) {
        const medarotIndex = this.uiState.selectedMedarotIndex;
        const slotKey = this.equipSlots[this.uiState.selectedEquipIndex];
        const move = direction === 'right' ? 1 : -1;

        const medarot = this.dataManager.getMedarot(medarotIndex);
        if (!medarot) return;

        if (slotKey === EquipSlotType.MEDAL) {
            this._changeItem(medarotIndex, medarot.medal?.id, this.dataManager.getAvailableMedals(), move, (newId) => {
                const req = this.world.createEntity();
                this.world.addComponent(req, new EquipMedalRequest(medarotIndex, newId));
            });
        } else {
            this._changeItem(medarotIndex, medarot.parts[slotKey]?.id, this.dataManager.getAvailableParts(slotKey), move, (newId) => {
                const req = this.world.createEntity();
                this.world.addComponent(req, new EquipPartRequest(medarotIndex, slotKey, newId));
            });
        }
    }

    _changeItem(medarotIndex, currentId, availableItems, move, emitAction) {
        if (availableItems.length <= 1) return;

        const currentIndex = currentId ? availableItems.findIndex(item => item.id === currentId) : -1;
        const nextIndex = (currentIndex + move + availableItems.length) % availableItems.length;
        const newItem = availableItems[nextIndex];
        
        if (newItem) {
            emitAction(newItem.id);
        }
    }

    renderAll() {
        // (前回と同じ描画ロジック)
        const medarots = this.dataManager.gameData.playerMedarots;
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        
        this.uiManager.renderMedarotList(medarots);
        this.uiManager.renderEquippedItems(medarot);

        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalSelected = selectedSlotType === EquipSlotType.MEDAL;
        
        let listTitle = '';
        if (isMedalSelected) {
            listTitle = `メダル一覧`;
            this.currentMedalListData = this.dataManager.getAvailableMedals();
            this.uiManager.renderSelectionList(listTitle, this.currentMedalListData);
        } else {
            listTitle = `${PartKeyToInfoMap[selectedSlotType]?.name || 'パーツ'}一覧`;
            this.currentPartListData = this.dataManager.getAvailableParts(selectedSlotType);
            this.uiManager.renderSelectionList(listTitle, this.currentPartListData);
        }

        let itemToShow = null;
        if (this.uiState.focus === 'EQUIP_PANEL') {
            itemToShow = isMedalSelected ? medarot?.medal?.data : medarot?.parts[selectedSlotType]?.data;
        } else if (this.uiState.focus === 'ITEM_LIST') {
            itemToShow = isMedalSelected
                ? this.currentMedalListData[this.uiState.selectedMedalListIndex]
                : this.currentPartListData[this.uiState.selectedPartListIndex];
        }
        this.uiManager.renderDetails(itemToShow);

        this.uiManager.updateFocus({
            focus: this.uiState.focus,
            selectedMedarotIndex: this.uiState.selectedMedarotIndex,
            selectedEquipIndex: this.uiState.selectedEquipIndex,
            selectedMedalListIndex: this.uiState.selectedMedalListIndex,
            selectedPartListIndex: this.uiState.selectedPartListIndex,
            currentSlotType: selectedSlotType
        });
    }
}