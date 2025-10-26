/**
 * @file カスタマイズ画面：UIシステム
 * UIの状態管理、DOMの描画、フォーカス制御を担当します。
 * InputSystemからのUIイベントを購読してUIの状態を更新し、画面を再描画します。
 * また、ロジックを実行する必要がある場合は、LogicSystemにイベントを発行します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameDataManager } from '../../core/GameDataManager.js';
import { PartInfo, PartKeyToInfoMap, EquipSlotType } from '../../battle/common/constants.js';
import { CustomizeState } from '../components/CustomizeState.js';

/**
 * UIのフォーカス状態遷移を宣言的に管理するマップ。
 * これにより、confirm/cancel時のロジックが簡潔になり、状態遷移の全体像を把握しやすくなります。
 */
const focusTransitionMap = {
    MEDAROT_SELECT: {
        confirm: 'EQUIP_PANEL',
        cancel: 'EXIT', // シーン終了を示す特別な状態
    },
    EQUIP_PANEL: {
        confirm: 'ITEM_LIST',
        cancel: 'MEDAROT_SELECT',
    },
    ITEM_LIST: {
        // confirmはアイテム装備アクションを実行するため、状態遷移はなし
        cancel: 'EQUIP_PANEL',
    },
};

export class CustomizeUISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.dataManager = new GameDataManager();
        this.uiState = this.world.getSingletonComponent(CustomizeState);

        this.dom = {};
        this.templates = {};

        // マジックストリングを排除し、定数を使用して装備スロットを定義
        this.partSlots = [EquipSlotType.HEAD, EquipSlotType.RIGHT_ARM, EquipSlotType.LEFT_ARM, EquipSlotType.LEGS];
        this.equipSlots = [...this.partSlots, EquipSlotType.MEDAL];
        
        this.currentPartListData = [];
        this.currentMedalListData = [];

        this.initDOM();
        this.bindWorldEvents();
        this.renderAll();
    }

    /**
     * DOM要素の参照とテンプレートをキャッシュする
     */
    initDOM() {
        this.dom.container = document.getElementById('customize-container');
        this.dom.medarotList = document.getElementById('medarot-select-list');
        this.dom.equippedMedarotName = document.getElementById('equipped-medarot-name');
        this.dom.equippedPartsList = document.getElementById('equipped-parts-list');
        this.dom.equippedMedalList = document.getElementById('equipped-medal-list');
        this.dom.partsListTitle = document.getElementById('parts-list-title');
        this.dom.partsList = document.getElementById('parts-list');
        this.dom.partDetailsContent = document.getElementById('part-details-content');
        this.templates.medarotItem = document.getElementById('medarot-list-item-template');
        this.templates.equippedPartItem = document.getElementById('equipped-part-item-template');
        this.templates.equippedMedalItem = document.getElementById('equipped-medal-item-template');
        this.templates.partListItem = document.getElementById('part-list-item-template');
    }

    /**
     * システムが購読するイベントを登録する
     */
    bindWorldEvents() {
        this.world.on('CUST_NAVIGATE_INPUT', this.handleNavigation.bind(this));
        this.world.on('CUST_CONFIRM_INPUT', this.handleConfirm.bind(this));
        this.world.on('CUST_CANCEL_INPUT', this.handleCancel.bind(this));
        this.world.on('PART_EQUIPPED', this.onPartEquipped.bind(this));
        this.world.on('MEDAL_EQUIPPED', this.onMedalEquipped.bind(this));
    }

    // --- イベントハンドラ ---

    handleNavigation(detail) {
        const { direction } = detail;
        let stateChanged = false;

        if (direction === 'up' || direction === 'down') {
            const verticalMove = direction === 'down' ? 1 : -1;
            switch (this.uiState.focus) {
                case 'MEDAROT_SELECT':
                    const medarotCount = this.dataManager.gameData.playerMedarots.length;
                    this.uiState.selectedMedarotIndex = (this.uiState.selectedMedarotIndex + verticalMove + medarotCount) % medarotCount;
                    this.uiState.selectedEquipIndex = 0;
                    stateChanged = true;
                    break;
                case 'EQUIP_PANEL':
                    this.uiState.selectedEquipIndex = (this.uiState.selectedEquipIndex + verticalMove + this.equipSlots.length) % this.equipSlots.length;
                    stateChanged = true;
                    break;
                case 'ITEM_LIST':
                    const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
                    const isMedalList = selectedSlotType === EquipSlotType.MEDAL;
                    if (isMedalList) {
                        if (this.currentMedalListData.length > 0) {
                            this.uiState.selectedMedalListIndex = (this.uiState.selectedMedalListIndex + verticalMove + this.currentMedalListData.length) % this.currentMedalListData.length;
                        }
                    } else {
                        if (this.currentPartListData.length > 0) {
                            this.uiState.selectedPartListIndex = (this.uiState.selectedPartListIndex + verticalMove + this.currentPartListData.length) % this.currentPartListData.length;
                        }
                    }
                    stateChanged = true;
                    break;
            }
        }

        if (stateChanged) {
            this.renderAll();
        }
    }

    /**
     * 決定ボタンの処理を状態遷移マップに基づいてリファクタリング
     */
    handleConfirm() {
        const currentFocus = this.uiState.focus;
        const nextFocus = focusTransitionMap[currentFocus]?.confirm;

        if (nextFocus) {
            // 次のフォーカス状態が定義されていれば遷移
            this.uiState.focus = nextFocus;
            if (nextFocus === 'ITEM_LIST') {
                // アイテムリストに遷移する際はインデックスをリセット
                this.uiState.selectedPartListIndex = 0;
                this.uiState.selectedMedalListIndex = 0;
            }
            this.renderAll();
        } else if (currentFocus === 'ITEM_LIST') {
            // ITEM_LISTで決定が押された場合は、装備アクションを実行
            this.triggerEquipAction();
        }
    }
    
    /**
     * キャンセルボタンの処理を状態遷移マップに基づいてリファクタリング
     */
    handleCancel() {
        const currentFocus = this.uiState.focus;
        const nextFocus = focusTransitionMap[currentFocus]?.cancel;

        if (nextFocus === 'EXIT') {
            // マップシーンへ戻る
            this.world.emit('CUSTOMIZE_EXIT_REQUESTED');
        } else if (nextFocus) {
            // 前のフォーカス状態へ遷移
            this.uiState.focus = nextFocus;
            this.renderAll();
        }
    }
    
    /**
     * 装備アクションを発行するロジックを分離
     * @private
     */
    triggerEquipAction() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalList = selectedSlotType === EquipSlotType.MEDAL;

        if (isMedalList) {
            const selectedMedal = this.currentMedalListData[this.uiState.selectedMedalListIndex];
            this.world.emit('EQUIP_MEDAL_REQUESTED', {
                medarotIndex: this.uiState.selectedMedarotIndex,
                newMedalId: selectedMedal?.id,
            });
        } else {
            const selectedPart = this.currentPartListData[this.uiState.selectedPartListIndex];
            this.world.emit('EQUIP_PART_REQUESTED', {
                medarotIndex: this.uiState.selectedMedarotIndex,
                partSlot: selectedSlotType,
                newPartId: selectedPart?.id,
            });
        }
    }

    onPartEquipped() {
        this.uiState.focus = 'EQUIP_PANEL';
        this.renderAll();
    }

    onMedalEquipped() {
        this.uiState.focus = 'EQUIP_PANEL';
        this.renderAll();
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
            const clone = this.templates.medarotItem.content.cloneNode(true);
            const item = clone.querySelector('li');
            item.dataset.index = index;
            item.querySelector('.medarot-name').textContent = medarot.name;
            this.dom.medarotList.appendChild(clone);
        });
    }

    renderEquippedItems() {
        this.dom.equippedPartsList.innerHTML = '';
        this.dom.equippedMedalList.innerHTML = '';
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        if (!medarot) return;

        this.dom.equippedMedarotName.textContent = medarot.name;

        // パーツを描画
        this.partSlots.forEach((slotKey, index) => {
            const part = medarot.parts[slotKey];
            const clone = this.templates.equippedPartItem.content.cloneNode(true);
            const item = clone.querySelector('li');
            item.dataset.index = index;
            item.dataset.slot = slotKey;

            const slotInfo = PartKeyToInfoMap[slotKey];
            item.querySelector('.part-slot-name').textContent = slotInfo ? slotInfo.name : '不明';
            item.querySelector('.part-name').textContent = part.data ? part.data.name : 'なし';
            this.dom.equippedPartsList.appendChild(clone);
        });

        // メダルを描画
        const medal = medarot.medal;
        const clone = this.templates.equippedMedalItem.content.cloneNode(true);
        const item = clone.querySelector('li');
        // インデックスとスロットキーを定数から設定
        item.dataset.index = this.partSlots.length;
        item.dataset.slot = EquipSlotType.MEDAL;
        item.querySelector('.part-name').textContent = medal.data ? medal.data.name : 'なし';
        this.dom.equippedMedalList.appendChild(clone);
    }

    renderSelectionList() {
        const selectedSlotType = this.equipSlots[this.uiState.selectedEquipIndex];
        const isMedalSelected = selectedSlotType === EquipSlotType.MEDAL;
        
        if (isMedalSelected) {
            this.dom.partsListTitle.textContent = `メダル一覧`;
            this.currentMedalListData = this.dataManager.getAvailableMedals();
            this.dom.partsList.innerHTML = '';
            this.currentMedalListData.forEach((medal, index) => {
                const clone = this.templates.partListItem.content.cloneNode(true);
                const item = clone.querySelector('li');
                item.dataset.index = index;
                item.querySelector('.part-name').textContent = medal.name;
                this.dom.partsList.appendChild(clone);
            });
        } else {
            this.dom.partsListTitle.textContent = `${PartKeyToInfoMap[selectedSlotType]?.name}一覧`;
            this.currentPartListData = this.dataManager.getAvailableParts(selectedSlotType);
            this.dom.partsList.innerHTML = '';
            this.currentPartListData.forEach((part, index) => {
                const clone = this.templates.partListItem.content.cloneNode(true);
                const item = clone.querySelector('li');
                item.dataset.index = index;
                item.querySelector('.part-name').textContent = part.name;
                this.dom.partsList.appendChild(clone);
            });
        }
    }

    renderDetails() {
        this.dom.partDetailsContent.innerHTML = '項目を選択してください';
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
            this.dom.partDetailsContent.innerHTML = this.createDetailHTML(itemToShow);
        }
    }

    createDetailHTML(item) {
        let html = `<div class="detail-item"><span class="label">名前</span><span class="value">${item.name}</span></div>`;
        if (item.personality) html += `<div class="detail-item"><span class="label">性格</span><span class="value">${item.personality}</span></div>`;
        if (item.action) html += `<div class="detail-item"><span class="label">アクション</span><span class="value">${item.action}</span></div>`;
        if (item.type) html += `<div class="detail-item"><span class="label">タイプ</span><span class="value">${item.type}</span></div>`;
        if (item.trait) html += `<div class="detail-item"><span class="label">特性</span><span class="value">${item.trait}</span></div>`;
        if (item.might) html += `<div class="detail-item"><span class="label">威力</span><span class="value">${item.might}</span></div>`;
        if (item.success) html += `<div class="detail-item"><span class="label">成功</span><span class="value">${item.success}</span></div>`;
        if (item.maxHp) html += `<div class="detail-item"><span class="label">装甲</span><span class="value">${item.maxHp}</span></div>`;
        if (item.propulsion) html += `<div class="detail-item"><span class="label">推進</span><span class="value">${item.propulsion}</span></div>`;
        if (item.mobility) html += `<div class="detail-item"><span class="label">機動</span><span class="value">${item.mobility}</span></div>`;
        if (item.armor) html += `<div class="detail-item"><span class="label">防御</span><span class="value">${item.armor}</span></div>`;
        if (item.stability) html += `<div class="detail-item"><span class="label">安定</span><span class="value">${item.stability}</span></div>`;
        return html;
    }

    updateAllFocus() {
        // 機体選択リストのフォーカス
        this.dom.medarotList.querySelectorAll('li').forEach(li => {
            const isFocused = this.uiState.focus === 'MEDAROT_SELECT' && parseInt(li.dataset.index) === this.uiState.selectedMedarotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // 装備パネルのフォーカス
        const allEquipItems = [
            ...this.dom.equippedPartsList.querySelectorAll('li'),
            ...this.dom.equippedMedalList.querySelectorAll('li')
        ];
        allEquipItems.forEach(li => {
            const isFocused = this.uiState.focus === 'EQUIP_PANEL' && parseInt(li.dataset.index) === this.uiState.selectedEquipIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });
        
        // アイテムリストのフォーカス
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

    update(deltaTime) {
        // UIシステムはイベント駆動のため、update処理は不要
    }

    destroy() {
        this.dom.container.classList.add('hidden');
    }
}