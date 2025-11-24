/**
 * @file カスタマイズ画面：UIシステム
 * UIの状態管理、DOMの描画、フォーカス制御を担当します。
 * DOM生成には `el` ユーティリティを使用し、宣言的に記述します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameDataManager } from '../../core/GameDataManager.js';
import { PartKeyToInfoMap, EquipSlotType } from '../../battle/common/constants.js';
import { CustomizeState } from '../components/CustomizeState.js';
import { GameEvents } from '../../battle/common/events.js';
import { el } from '../../core/utils/domUtils.js';

const focusTransitionMap = {
    MEDAROT_SELECT: { confirm: 'EQUIP_PANEL', cancel: 'EXIT' },
    EQUIP_PANEL: { confirm: 'ITEM_LIST', cancel: 'MEDAROT_SELECT' },
    ITEM_LIST: { cancel: 'EQUIP_PANEL' },
};

export class CustomizeUISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.dataManager = new GameDataManager();
        this.uiState = this.world.getSingletonComponent(CustomizeState);

        this.dom = {};
        this.partSlots = [EquipSlotType.HEAD, EquipSlotType.RIGHT_ARM, EquipSlotType.LEFT_ARM, EquipSlotType.LEGS];
        this.equipSlots = [EquipSlotType.MEDAL, ...this.partSlots];
        
        this.currentPartListData = [];
        this.currentMedalListData = [];

        this._initDOM();
        this._bindEvents();
        this.renderAll();
    }

    _initDOM() {
        this.dom.container = document.getElementById('customize-container');
        this.dom.medarotList = document.getElementById('medarot-select-list');
        this.dom.equippedMedarotName = document.getElementById('equipped-medarot-name');
        this.dom.equippedPartsList = document.getElementById('equipped-parts-list');
        this.dom.equippedMedalList = document.getElementById('equipped-medal-list');
        this.dom.partsListTitle = document.getElementById('parts-list-title');
        this.dom.partsList = document.getElementById('parts-list');
        this.dom.partDetailsContent = document.getElementById('part-details-content');
    }

    _bindEvents() {
        this.world.on(GameEvents.CUST_NAVIGATE_INPUT, this.handleNavigation.bind(this));
        this.world.on(GameEvents.CUST_CONFIRM_INPUT, this.handleConfirm.bind(this));
        this.world.on(GameEvents.CUST_CANCEL_INPUT, this.handleCancel.bind(this));
        this.world.on(GameEvents.PART_EQUIPPED, this.onItemEquipped.bind(this));
        this.world.on(GameEvents.MEDAL_EQUIPPED, this.onItemEquipped.bind(this));
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
            return false; // イベント発行により再描画されるため
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

    // --- 描画メソッド ---

    renderAll() {
        this.renderMedarotList();
        this.renderEquippedItems();
        this.renderSelectionList();
        this.renderDetails();
        this.updateAllFocus();
    }
    
    renderMedarotList() {
        this.dom.medarotList.innerHTML = '';
        const medarots = this.dataManager.gameData.playerMedarots;
        
        medarots.forEach((medarot, index) => {
            const li = el('li', { 
                className: 'medarot-list-item',
                dataset: { index: index }
            }, [
                el('span', { className: 'medarot-name' }, medarot.name)
            ]);
            this.dom.medarotList.appendChild(li);
        });
    }

    renderEquippedItems() {
        this.dom.equippedPartsList.innerHTML = '';
        this.dom.equippedMedalList.innerHTML = '';
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        if (!medarot) return;

        this.dom.equippedMedarotName.textContent = medarot.name;

        this.equipSlots.forEach((slotKey, index) => {
            const isMedal = slotKey === EquipSlotType.MEDAL;
            const itemData = isMedal ? medarot.medal : medarot.parts[slotKey];
            const slotName = isMedal ? 'メダル' : (PartKeyToInfoMap[slotKey]?.name || '不明');
            
            const li = el('li', {
                className: 'equipped-part-item',
                dataset: { index: index, slot: slotKey }
            }, [
                el('span', { className: 'part-slot-name' }, slotName),
                el('span', { className: 'part-name' }, itemData.data ? itemData.data.name : 'なし')
            ]);
            
            if (isMedal) {
                this.dom.equippedMedalList.appendChild(li);
            } else {
                this.dom.equippedPartsList.appendChild(li);
            }
        });
    }

    renderSelectionList() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalSelected = selectedSlotType === EquipSlotType.MEDAL;
        
        this.dom.partsList.innerHTML = '';

        if (isMedalSelected) {
            this.dom.partsListTitle.textContent = `メダル一覧`;
            this.currentMedalListData = this.dataManager.getAvailableMedals();
            this._renderListItems(this.currentMedalListData);
        } else {
            this.dom.partsListTitle.textContent = `${PartKeyToInfoMap[selectedSlotType]?.name || 'パーツ'}一覧`;
            this.currentPartListData = this.dataManager.getAvailableParts(selectedSlotType);
            this._renderListItems(this.currentPartListData);
        }
    }

    _renderListItems(items) {
        items.forEach((item, index) => {
            const li = el('li', {
                className: 'part-list-item',
                dataset: { index: index }
            }, [
                el('span', { className: 'part-name' }, item.name)
            ]);
            this.dom.partsList.appendChild(li);
        });
    }

    renderDetails() {
        this.dom.partDetailsContent.innerHTML = '';
        let itemToShow = null;
        
        if (this.uiState.focus === 'EQUIP_PANEL') {
            itemToShow = this._getSelectedItemFromEquipPanel();
        } else if (this.uiState.focus === 'ITEM_LIST') {
            itemToShow = this._getSelectedItemFromList();
        }

        if (itemToShow) {
            this.dom.partDetailsContent.appendChild(this._createDetailContent(itemToShow));
        } else {
            this.dom.partDetailsContent.textContent = '項目を選択してください';
        }
    }

    _getSelectedItemFromEquipPanel() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        return selectedSlotType === EquipSlotType.MEDAL ? medarot?.medal?.data : medarot?.parts[selectedSlotType]?.data;
    }

    _getSelectedItemFromList() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        return selectedSlotType === EquipSlotType.MEDAL
            ? this.currentMedalListData[this.uiState.selectedMedalListIndex]
            : this.currentPartListData[this.uiState.selectedPartListIndex];
    }

    _createDetailContent(item) {
        const createItem = (label, value) => el('div', { className: 'detail-item' }, [
            el('span', { className: 'label' }, label),
            el('span', { className: 'value' }, String(value))
        ]);

        const children = [createItem('名前', item.name)];
        
        const props = {
            personality: '性格', action: 'アクション', type: 'タイプ', trait: '特性',
            might: '威力', success: '成功', maxHp: '装甲',
            propulsion: '推進', mobility: '機動', armor: '防御', stability: '安定'
        };

        for (const [key, label] of Object.entries(props)) {
            if (item[key] !== undefined) children.push(createItem(label, item[key]));
        }

        return el('div', {}, children);
    }

    updateAllFocus() {
        // メダロットリストのフォーカス
        this._updateListFocus(this.dom.medarotList, this.uiState.focus === 'MEDAROT_SELECT', this.uiState.selectedMedarotIndex);
        
        // 装備パネルのフォーカス
        const allEquipItems = [
            ...this.dom.equippedMedalList.querySelectorAll('li'),
            ...this.dom.equippedPartsList.querySelectorAll('li')
        ];
        allEquipItems.forEach(li => {
            const isFocused = this.uiState.focus === 'EQUIP_PANEL' && parseInt(li.dataset.index) === this.uiState.selectedEquipIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // 選択リストのフォーカス
        const isMedalList = this.equipSlots[this.uiState.selectedEquipIndex] === EquipSlotType.MEDAL;
        const listIndex = isMedalList ? this.uiState.selectedMedalListIndex : this.uiState.selectedPartListIndex;
        this._updateListFocus(this.dom.partsList, this.uiState.focus === 'ITEM_LIST', listIndex);
    }

    _updateListFocus(listElement, isPanelFocused, selectedIndex) {
        listElement.querySelectorAll('li').forEach(li => {
            const isItemFocused = isPanelFocused && parseInt(li.dataset.index) === selectedIndex;
            li.classList.toggle('focused', isItemFocused);
            if (isItemFocused) li.scrollIntoView({ block: 'nearest' });
        });
    }

    destroy() {
        this.dom.container.classList.add('hidden');
    }
}