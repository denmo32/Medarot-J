/**
 * @file カスタマイズ画面：UIシステム
 * UIの状態管理、DOMの描画、フォーカス制御を担当します。
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

        this.initDOM();
        this.bindWorldEvents();
        this.renderAll();
    }

    initDOM() {
        this.dom.container = document.getElementById('customize-container');
        this.dom.medarotList = document.getElementById('medarot-select-list');
        this.dom.equippedMedarotName = document.getElementById('equipped-medarot-name');
        this.dom.equippedPartsList = document.getElementById('equipped-parts-list');
        this.dom.equippedMedalList = document.getElementById('equipped-medal-list');
        this.dom.partsListTitle = document.getElementById('parts-list-title');
        this.dom.partsList = document.getElementById('parts-list');
        this.dom.partDetailsContent = document.getElementById('part-details-content');
    }

    bindWorldEvents() {
        this.world.on(GameEvents.CUST_NAVIGATE_INPUT, this.handleNavigation.bind(this));
        this.world.on(GameEvents.CUST_CONFIRM_INPUT, this.handleConfirm.bind(this));
        this.world.on(GameEvents.CUST_CANCEL_INPUT, this.handleCancel.bind(this));
        this.world.on(GameEvents.PART_EQUIPPED, this.onPartEquipped.bind(this));
        this.world.on(GameEvents.MEDAL_EQUIPPED, this.onMedalEquipped.bind(this));
    }

    handleNavigation(detail) {
        const { direction } = detail;
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
            // changeEquippedItem内でイベント発行による再描画が行われるため、ここではfalseを返す
            return false; 
        }
        return false;
    }

    _handleItemListNav(direction) {
        const verticalMove = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
        if (verticalMove === 0) return false;

        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        if (selectedSlotType === EquipSlotType.MEDAL) {
            if (this.currentMedalListData.length > 0) {
                this.uiState.selectedMedalListIndex = (this.uiState.selectedMedalListIndex + verticalMove + this.currentMedalListData.length) % this.currentMedalListData.length;
                return true;
            }
        } else {
            if (this.currentPartListData.length > 0) {
                this.uiState.selectedPartListIndex = (this.uiState.selectedPartListIndex + verticalMove + this.currentPartListData.length) % this.currentPartListData.length;
                return true;
            }
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
        const isMedalList = selectedSlotType === EquipSlotType.MEDAL;

        if (isMedalList) {
            const selectedMedal = this.currentMedalListData[this.uiState.selectedMedalListIndex];
            this.world.emit(GameEvents.EQUIP_MEDAL_REQUESTED, {
                medarotIndex: this.uiState.selectedMedarotIndex,
                newMedalId: selectedMedal?.id,
            });
        } else {
            const selectedPart = this.currentPartListData[this.uiState.selectedPartListIndex];
            this.world.emit(GameEvents.EQUIP_PART_REQUESTED, {
                medarotIndex: this.uiState.selectedMedarotIndex,
                partSlot: selectedSlotType,
                newPartId: selectedPart?.id,
            });
        }
    }

    onPartEquipped() {
        this._returnFocusToPanel();
    }

    onMedalEquipped() {
        this._returnFocusToPanel();
    }

    _returnFocusToPanel() {
        if (this.uiState.focus !== 'EQUIP_PANEL') {
            this.uiState.focus = 'EQUIP_PANEL';
        }
        this.renderAll();
    }
    
    changeEquippedItem(direction) {
        const medarotIndex = this.uiState.selectedMedarotIndex;
        const slotIndex = this.uiState.selectedEquipIndex;
        const slotKey = this.equipSlots[slotIndex];
        const move = direction === 'right' ? 1 : -1;

        const medarot = this.dataManager.getMedarot(medarotIndex);
        if (!medarot) return;

        if (slotKey === EquipSlotType.MEDAL) {
            this._changeMedal(medarotIndex, medarot, move);
        } else {
            this._changePart(medarotIndex, medarot, slotKey, move);
        }
    }

    _changeMedal(medarotIndex, medarot, move) {
        const availableItems = this.dataManager.getAvailableMedals();
        if (availableItems.length <= 1) return;

        const currentId = medarot.medal?.id;
        const currentIndex = currentId ? availableItems.findIndex(item => item.id === currentId) : -1;
        const nextIndex = this._calculateNextIndex(currentIndex, move, availableItems.length);

        const newItem = availableItems[nextIndex];
        if (newItem) {
            this.world.emit(GameEvents.EQUIP_MEDAL_REQUESTED, { medarotIndex, newMedalId: newItem.id });
        }
    }

    _changePart(medarotIndex, medarot, slotKey, move) {
        const availableItems = this.dataManager.getAvailableParts(slotKey);
        if (availableItems.length <= 1) return;

        const currentId = medarot.parts[slotKey]?.id;
        const currentIndex = currentId ? availableItems.findIndex(item => item.id === currentId) : -1;
        const nextIndex = this._calculateNextIndex(currentIndex, move, availableItems.length);

        const newItem = availableItems[nextIndex];
        if (newItem) {
            this.world.emit(GameEvents.EQUIP_PART_REQUESTED, { medarotIndex, partSlot: slotKey, newPartId: newItem.id });
        }
    }

    _calculateNextIndex(currentIndex, move, length) {
        if (currentIndex === -1) {
            return move > 0 ? 0 : length - 1;
        }
        return (currentIndex + move + length) % length;
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
            const itemElement = (slotKey === EquipSlotType.MEDAL)
                ? this._createMedalListItem(medarot.medal, index, slotKey)
                : this._createPartListItem(medarot.parts[slotKey], index, slotKey);
            
            if (slotKey === EquipSlotType.MEDAL) {
                this.dom.equippedMedalList.appendChild(itemElement);
            } else {
                this.dom.equippedPartsList.appendChild(itemElement);
            }
        });
    }

    _createMedalListItem(medal, index, slotKey) {
        return el('li', {
            className: 'equipped-part-item',
            dataset: { index: index, slot: slotKey }
        }, [
            el('span', { className: 'part-slot-name' }, 'メダル'),
            el('span', { className: 'part-name' }, medal.data ? medal.data.name : 'なし')
        ]);
    }

    _createPartListItem(part, index, slotKey) {
        const slotInfo = PartKeyToInfoMap[slotKey];
        return el('li', {
            className: 'equipped-part-item',
            dataset: { index: index, slot: slotKey }
        }, [
            el('span', { className: 'part-slot-name' }, slotInfo ? slotInfo.name : '不明'),
            el('span', { className: 'part-name' }, part.data ? part.data.name : 'なし')
        ]);
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
            this.dom.partsListTitle.textContent = `${PartKeyToInfoMap[selectedSlotType]?.name}一覧`;
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
        
        // 詳細表示対象の決定ロジック
        if (this.uiState.focus === 'EQUIP_PANEL') {
            itemToShow = this._getSelectedItemFromEquipPanel();
        } else if (this.uiState.focus === 'ITEM_LIST') {
            itemToShow = this._getSelectedItemFromList();
        }

        if (itemToShow) {
            this.dom.partDetailsContent.appendChild(this.createDetailContent(itemToShow));
        } else {
            this.dom.partDetailsContent.textContent = '項目を選択してください';
        }
    }

    _getSelectedItemFromEquipPanel() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        if (selectedSlotType === EquipSlotType.MEDAL) {
            return medarot?.medal?.data;
        } else {
            return medarot?.parts[selectedSlotType]?.data;
        }
    }

    _getSelectedItemFromList() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalListFocused = selectedSlotType === EquipSlotType.MEDAL;
        if (isMedalListFocused) {
            return this.currentMedalListData[this.uiState.selectedMedalListIndex];
        } else {
            return this.currentPartListData[this.uiState.selectedPartListIndex];
        }
    }

    createDetailContent(item) {
        const container = el('div');
        const createItem = (label, value) => {
            return el('div', { className: 'detail-item' }, [
                el('span', { className: 'label' }, label),
                el('span', { className: 'value' }, String(value))
            ]);
        };

        container.appendChild(createItem('名前', item.name));
        if (item.personality) container.appendChild(createItem('性格', item.personality));

        if (item.action) container.appendChild(createItem('アクション', item.action));
        if (item.type) container.appendChild(createItem('タイプ', item.type));
        if (item.trait) container.appendChild(createItem('特性', item.trait));
        if (item.might !== undefined) container.appendChild(createItem('威力', item.might));
        if (item.success !== undefined) container.appendChild(createItem('成功', item.success));
        if (item.maxHp !== undefined) container.appendChild(createItem('装甲', item.maxHp));
        if (item.propulsion !== undefined) container.appendChild(createItem('推進', item.propulsion));
        if (item.mobility !== undefined) container.appendChild(createItem('機動', item.mobility));
        if (item.armor !== undefined) container.appendChild(createItem('防御', item.armor));
        if (item.stability !== undefined) container.appendChild(createItem('安定', item.stability));

        return container;
    }

    updateAllFocus() {
        this._updateListFocus(this.dom.medarotList, this.uiState.focus === 'MEDAROT_SELECT', this.uiState.selectedMedarotIndex);
        
        const allEquipItems = [
            ...this.dom.equippedMedalList.querySelectorAll('li'),
            ...this.dom.equippedPartsList.querySelectorAll('li')
        ];
        // 装備パネルのフォーカス更新（リスト構造がDOM上で分かれているため個別処理）
        allEquipItems.forEach(li => {
            const isFocused = this.uiState.focus === 'EQUIP_PANEL' && parseInt(li.dataset.index) === this.uiState.selectedEquipIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalList = selectedSlotType === EquipSlotType.MEDAL;
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