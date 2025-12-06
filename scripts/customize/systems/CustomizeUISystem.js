import { System } from '../../../engine/core/System.js';
import { PartKeyToInfoMap, EquipSlotType } from '../../common/constants.js';
import { CustomizeState } from '../components/CustomizeState.js';
import { GameEvents } from '../../common/events.js';
import { CustomizeUIManager } from '../ui/CustomizeUIManager.js';

const focusTransitionMap = {
    MEDAROT_SELECT: { confirm: 'EQUIP_PANEL', cancel: 'EXIT' },
    EQUIP_PANEL: { confirm: 'ITEM_LIST', cancel: 'MEDAROT_SELECT' },
    ITEM_LIST: { cancel: 'EQUIP_PANEL' },
};

export class CustomizeUISystem extends System {
    /**
     * @param {World} world 
     * @param {GameDataManager} gameDataManager 依存性注入
     */
    constructor(world, gameDataManager) {
        super(world);
        this.dataManager = gameDataManager;
        this.uiState = this.world.getSingletonComponent(CustomizeState);
        this.uiManager = new CustomizeUIManager();

        this.equipSlots = this.uiManager.equipSlots;
        
        this.currentPartListData = [];
        this.currentMedalListData = [];

        this._bindEvents();
        
        // 初期表示
        this.uiManager.show();
        this.renderAll();
    }
    
    destroy() {
        this.uiManager.hide();
        super.destroy();
    }

    _bindEvents() {
        this.on(GameEvents.CUST_NAVIGATE_INPUT, this.handleNavigation.bind(this));
        this.on(GameEvents.CUST_CONFIRM_INPUT, this.handleConfirm.bind(this));
        this.on(GameEvents.CUST_CANCEL_INPUT, this.handleCancel.bind(this));
        this.on(GameEvents.PART_EQUIPPED, this.onItemEquipped.bind(this));
        this.on(GameEvents.MEDAL_EQUIPPED, this.onItemEquipped.bind(this));
    }

    handleNavigation({ direction }) {
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
            this.world.emit(GameEvents.CUSTOMIZE_EXIT_REQUESTED);
        } else if (nextFocus) {
            this.uiState.focus = nextFocus;
            this.renderAll();
        }
    }
    
    triggerEquipAction() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const medarotIndex = this.uiState.selectedMedarotIndex;

        if (selectedSlotType === EquipSlotType.MEDAL) {
            const selectedMedal = this.currentMedalListData[this.uiState.selectedMedalListIndex];
            this.world.emit(GameEvents.EQUIP_MEDAL_REQUESTED, {
                medarotIndex,
                newMedalId: selectedMedal?.id,
            });
        } else {
            const selectedPart = this.currentPartListData[this.uiState.selectedPartListIndex];
            this.world.emit(GameEvents.EQUIP_PART_REQUESTED, {
                medarotIndex,
                partSlot: selectedSlotType,
                newPartId: selectedPart?.id,
            });
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
            this._changeItem(medarotIndex, medarot.medal?.id, this.dataManager.getAvailableMedals(), move, (newId) => 
                this.world.emit(GameEvents.EQUIP_MEDAL_REQUESTED, { medarotIndex, newMedalId: newId })
            );
        } else {
            this._changeItem(medarotIndex, medarot.parts[slotKey]?.id, this.dataManager.getAvailableParts(slotKey), move, (newId) =>
                this.world.emit(GameEvents.EQUIP_PART_REQUESTED, { medarotIndex, partSlot: slotKey, newPartId: newId })
            );
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
        const medarots = this.dataManager.gameData.playerMedarots;
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        
        // 1. メダロットリスト更新
        this.uiManager.renderMedarotList(medarots);

        // 2. 装備アイテム更新
        this.uiManager.renderEquippedItems(medarot);

        // 3. 選択リスト更新 (アイテム一覧)
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

        // 4. 詳細パネル更新
        let itemToShow = null;
        if (this.uiState.focus === 'EQUIP_PANEL') {
            itemToShow = isMedalSelected ? medarot?.medal?.data : medarot?.parts[selectedSlotType]?.data;
        } else if (this.uiState.focus === 'ITEM_LIST') {
            itemToShow = isMedalSelected
                ? this.currentMedalListData[this.uiState.selectedMedalListIndex]
                : this.currentPartListData[this.uiState.selectedPartListIndex];
        }
        this.uiManager.renderDetails(itemToShow);

        // 5. フォーカス表示の更新
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