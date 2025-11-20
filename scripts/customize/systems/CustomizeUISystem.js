/**
 * @file カスタマイズ画面：UIシステム
 * UIの状態管理、DOMの描画、フォーカス制御を担当します。
 * InputSystemからのUIイベントを購読してUIの状態を更新し、画面を再描画します。
 * HTML文字列連結を廃止し、domUtilsのel関数を使用したセキュアなDOM構築に移行しました。
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
        this.templates = {}; // [リファクタリング] テンプレートの参照は残すが、動的生成部分はelに移行

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
            case 'MEDAROT_SELECT': {
                const verticalMove = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
                if (verticalMove !== 0) {
                    const medarotCount = this.dataManager.gameData.playerMedarots.length;
                    this.uiState.selectedMedarotIndex = (this.uiState.selectedMedarotIndex + verticalMove + medarotCount) % medarotCount;
                    this.uiState.selectedEquipIndex = 0;
                    stateChanged = true;
                }
                break;
            }
            case 'EQUIP_PANEL': {
                if (direction === 'up' || direction === 'down') {
                    const move = direction === 'down' ? 1 : -1;
                    const slotCount = this.equipSlots.length;
                    this.uiState.selectedEquipIndex = (this.uiState.selectedEquipIndex + move + slotCount) % slotCount;
                    stateChanged = true;
                } else if (direction === 'left' || direction === 'right') {
                    this.changeEquippedItem(direction);
                }
                break;
            }
            case 'ITEM_LIST': {
                const verticalMove = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
                if (verticalMove !== 0) {
                    const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
                    if (selectedSlotType === EquipSlotType.MEDAL) {
                        if (this.currentMedalListData.length > 0) {
                            this.uiState.selectedMedalListIndex = (this.uiState.selectedMedalListIndex + verticalMove + this.currentMedalListData.length) % this.currentMedalListData.length;
                        }
                    } else {
                        if (this.currentPartListData.length > 0) {
                            this.uiState.selectedPartListIndex = (this.uiState.selectedPartListIndex + verticalMove + this.currentPartListData.length) % this.currentPartListData.length;
                        }
                    }
                    stateChanged = true;
                }
                break;
            }
        }

        if (stateChanged) {
            this.renderAll();
        }
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
        if (this.uiState.focus !== 'EQUIP_PANEL') {
            this.uiState.focus = 'EQUIP_PANEL';
        }
        this.renderAll();
    }

    onMedalEquipped() {
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
            const availableItems = this.dataManager.getAvailableMedals();
            if (availableItems.length <= 1) return;

            const currentId = medarot.medal?.id;
            const currentIndex = currentId ? availableItems.findIndex(item => item.id === currentId) : -1;
            
            const nextIndex = (currentIndex === -1) 
                ? (move > 0 ? 0 : availableItems.length - 1)
                : (currentIndex + move + availableItems.length) % availableItems.length;

            const newItem = availableItems[nextIndex];
            if (newItem) {
                this.world.emit(GameEvents.EQUIP_MEDAL_REQUESTED, { medarotIndex, newMedalId: newItem.id });
            }
        } else {
            const availableItems = this.dataManager.getAvailableParts(slotKey);
            if (availableItems.length <= 1) return;

            const currentId = medarot.parts[slotKey]?.id;
            const currentIndex = currentId ? availableItems.findIndex(item => item.id === currentId) : -1;
            
            const nextIndex = (currentIndex === -1)
                ? (move > 0 ? 0 : availableItems.length - 1)
                : (currentIndex + move + availableItems.length) % availableItems.length;

            const newItem = availableItems[nextIndex];
            if (newItem) {
                this.world.emit(GameEvents.EQUIP_PART_REQUESTED, { medarotIndex, partSlot: slotKey, newPartId: newItem.id });
            }
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
            // elを使用してDOM生成
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
            if (slotKey === EquipSlotType.MEDAL) {
                const medal = medarot.medal;
                const li = el('li', {
                    className: 'equipped-part-item',
                    dataset: { index: index, slot: slotKey }
                }, [
                    el('span', { className: 'part-slot-name' }, 'メダル'),
                    el('span', { className: 'part-name' }, medal.data ? medal.data.name : 'なし')
                ]);
                this.dom.equippedMedalList.appendChild(li);
            } else {
                const part = medarot.parts[slotKey];
                const slotInfo = PartKeyToInfoMap[slotKey];
                const li = el('li', {
                    className: 'equipped-part-item',
                    dataset: { index: index, slot: slotKey }
                }, [
                    el('span', { className: 'part-slot-name' }, slotInfo ? slotInfo.name : '不明'),
                    el('span', { className: 'part-name' }, part.data ? part.data.name : 'なし')
                ]);
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
            this.currentMedalListData.forEach((medal, index) => {
                const li = el('li', {
                    className: 'part-list-item',
                    dataset: { index: index }
                }, [
                    el('span', { className: 'part-name' }, medal.name)
                ]);
                this.dom.partsList.appendChild(li);
            });
        } else {
            this.dom.partsListTitle.textContent = `${PartKeyToInfoMap[selectedSlotType]?.name}一覧`;
            this.currentPartListData = this.dataManager.getAvailableParts(selectedSlotType);
            this.currentPartListData.forEach((part, index) => {
                const li = el('li', {
                    className: 'part-list-item',
                    dataset: { index: index }
                }, [
                    el('span', { className: 'part-name' }, part.name)
                ]);
                this.dom.partsList.appendChild(li);
            });
        }
    }

    renderDetails() {
        this.dom.partDetailsContent.innerHTML = ''; // 初期化
        let itemToShow = null;
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalListFocused = this.uiState.focus === 'ITEM_LIST' && selectedSlotType === EquipSlotType.MEDAL;

        if (this.uiState.focus === 'EQUIP_PANEL') {
            const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
            if (selectedSlotType === EquipSlotType.MEDAL) {
                itemToShow = medarot?.medal?.data;
            } else {
                itemToShow = medarot?.parts[selectedSlotType]?.data;
            }
        } else if (this.uiState.focus === 'ITEM_LIST') {
            if (isMedalListFocused) {
                itemToShow = this.currentMedalListData[this.uiState.selectedMedalListIndex];
            } else {
                itemToShow = this.currentPartListData[this.uiState.selectedPartListIndex];
            }
        }

        if (itemToShow) {
            this.dom.partDetailsContent.appendChild(this.createDetailContent(itemToShow));
        } else {
            this.dom.partDetailsContent.textContent = '項目を選択してください';
        }
    }

    /**
     * 詳細表示用のDOM要素を作成します (innerHTML廃止)
     * @param {object} item - 表示するアイテムデータ
     * @returns {HTMLElement} DOM要素
     */
    createDetailContent(item) {
        const container = el('div');
        
        const createItem = (label, value) => {
            return el('div', { className: 'detail-item' }, [
                el('span', { className: 'label' }, label),
                el('span', { className: 'value' }, String(value))
            ]);
        };

        // 共通項目
        container.appendChild(createItem('名前', item.name));
        if (item.personality) container.appendChild(createItem('性格', item.personality));

        // パーツ固有項目
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
        // 機体選択リスト
        this.dom.medarotList.querySelectorAll('li').forEach(li => {
            const isFocused = this.uiState.focus === 'MEDAROT_SELECT' && parseInt(li.dataset.index) === this.uiState.selectedMedarotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // 装備パネル
        const allEquipItems = [
            ...this.dom.equippedMedalList.querySelectorAll('li'),
            ...this.dom.equippedPartsList.querySelectorAll('li')
        ];
        allEquipItems.forEach(li => {
            const isFocused = this.uiState.focus === 'EQUIP_PANEL' && parseInt(li.dataset.index) === this.uiState.selectedEquipIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });
        
        // アイテムリスト
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalList = this.uiState.focus === 'ITEM_LIST' && selectedSlotType === EquipSlotType.MEDAL;
        this.dom.partsList.querySelectorAll('li').forEach(li => {
            let isFocused = false;
            if (this.uiState.focus === 'ITEM_LIST') {
                if(isMedalList) {
                    isFocused = parseInt(li.dataset.index) === this.uiState.selectedMedalListIndex;
                } else {
                    isFocused = parseInt(li.dataset.index) === this.uiState.selectedPartListIndex;
                }
            }
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });
    }

    update(deltaTime) {}

    destroy() {
        this.dom.container.classList.add('hidden');
    }
}