/**
 * @file カスタマイズ画面：UIシステム
 * UIの状態管理、DOMの描画、フォーカス制御を担当します。
 * InputSystemからのUIイベントを購読してUIの状態を更新し、画面を再描画します。
 * また、ロジックを実行する必要がある場合は、LogicSystemにイベントを発行します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameDataManager } from '../../core/GameDataManager.js';
import { PartInfo, PartKeyToInfoMap } from '../../battle/common/constants.js';
import { CustomizeState } from '../components/CustomizeState.js';

export class CustomizeUISystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.dataManager = new GameDataManager();
        this.uiState = this.world.getSingletonComponent(CustomizeState);

        this.dom = {};
        this.templates = {};

        this.partSlots = [PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key, PartInfo.LEGS.key];
        this.currentPartListData = [];

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
        this.dom.partsListTitle = document.getElementById('parts-list-title');
        this.dom.partsList = document.getElementById('parts-list');
        this.dom.partDetailsContent = document.getElementById('part-details-content');

        this.templates.medarotItem = document.getElementById('medarot-list-item-template');
        this.templates.equippedPartItem = document.getElementById('equipped-part-item-template');
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
                    stateChanged = true;
                    break;
                case 'PART_SLOT':
                    this.uiState.selectedPartSlotIndex = (this.uiState.selectedPartSlotIndex + verticalMove + this.partSlots.length) % this.partSlots.length;
                    stateChanged = true;
                    break;
                case 'PART_LIST':
                    if (this.currentPartListData.length > 0) {
                        this.uiState.selectedPartListIndex = (this.uiState.selectedPartListIndex + verticalMove + this.currentPartListData.length) % this.currentPartListData.length;
                    }
                    stateChanged = true;
                    break;
            }
        }

        if (stateChanged) {
            this.renderAll();
        }
    }

    handleConfirm() {
        let stateChanged = false;
        switch (this.uiState.focus) {
            case 'MEDAROT_SELECT':
                this.uiState.focus = 'PART_SLOT';
                stateChanged = true;
                break;
            case 'PART_SLOT':
                this.uiState.focus = 'PART_LIST';
                this.uiState.selectedPartListIndex = 0;
                stateChanged = true;
                break;
            case 'PART_LIST':
                const selectedSlot = this.partSlots[this.uiState.selectedPartSlotIndex];
                const selectedPart = this.currentPartListData[this.uiState.selectedPartListIndex];
                this.world.emit('EQUIP_PART_REQUESTED', {
                    medarotIndex: this.uiState.selectedMedarotIndex,
                    partSlot: selectedSlot,
                    newPartId: selectedPart?.id
                });
                break;
        }
        if (stateChanged) {
            this.renderAll();
        }
    }
    
    handleCancel() {
        let stateChanged = false;
        switch (this.uiState.focus) {
            case 'PART_SLOT':
                this.uiState.focus = 'MEDAROT_SELECT';
                stateChanged = true;
                break;
            case 'PART_LIST':
                this.uiState.focus = 'PART_SLOT';
                stateChanged = true;
                break;
            case 'MEDAROT_SELECT':
                this.world.emit('CUSTOMIZE_EXIT_REQUESTED');
                break;
        }
        if (stateChanged) {
            this.renderAll();
        }
    }
    
    onPartEquipped() {
        // パーツ装備後、フォーカスを装備スロットリストに戻す
        this.uiState.focus = 'PART_SLOT';
        this.renderAll();
    }
    
    // --- 描画メソッド ---

    renderAll() {
        this.renderMedarotList();
        this.renderEquippedParts();
        this.renderPartsList();
        this.renderPartDetails();
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

    renderEquippedParts() {
        this.dom.equippedPartsList.innerHTML = '';
        const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
        if (!medarot) return;

        this.dom.equippedMedarotName.textContent = medarot.name;

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
    }

    renderPartsList() {
        const selectedSlot = this.partSlots[this.uiState.selectedPartSlotIndex];
        this.dom.partsListTitle.textContent = `${PartKeyToInfoMap[selectedSlot]?.name}一覧`;
        
        this.currentPartListData = this.dataManager.getAvailableParts(selectedSlot);
        this.dom.partsList.innerHTML = '';
        this.currentPartListData.forEach((part, index) => {
            const clone = this.templates.partListItem.content.cloneNode(true);
            const item = clone.querySelector('li');
            item.dataset.index = index;
            item.querySelector('.part-name').textContent = part.name;
            this.dom.partsList.appendChild(clone);
        });
    }

    renderPartDetails() {
        this.dom.partDetailsContent.innerHTML = 'パーツを選択してください';
        let partToShow = null;

        if (this.uiState.focus === 'PART_SLOT') {
            const medarot = this.dataManager.getMedarot(this.uiState.selectedMedarotIndex);
            const slotKey = this.partSlots[this.uiState.selectedPartSlotIndex];
            partToShow = medarot?.parts[slotKey]?.data;
        } else if (this.uiState.focus === 'PART_LIST') {
            partToShow = this.currentPartListData[this.uiState.selectedPartListIndex];
        }

        if (partToShow) {
            this.dom.partDetailsContent.innerHTML = this.createDetailHTML(partToShow);
        }
    }

    createDetailHTML(part) {
        let html = `<div class="detail-item"><span class="label">名前</span><span class="value">${part.name}</span></div>`;
        if (part.action) html += `<div class="detail-item"><span class="label">アクション</span><span class="value">${part.action}</span></div>`;
        if (part.type) html += `<div class="detail-item"><span class="label">タイプ</span><span class="value">${part.type}</span></div>`;
        if (part.trait) html += `<div class="detail-item"><span class="label">特性</span><span class="value">${part.trait}</span></div>`;
        if (part.might) html += `<div class="detail-item"><span class="label">威力</span><span class="value">${part.might}</span></div>`;
        if (part.success) html += `<div class="detail-item"><span class="label">成功</span><span class="value">${part.success}</span></div>`;
        if (part.maxHp) html += `<div class="detail-item"><span class="label">装甲</span><span class="value">${part.maxHp}</span></div>`;
        if (part.propulsion) html += `<div class="detail-item"><span class="label">推進</span><span class="value">${part.propulsion}</span></div>`;
        if (part.mobility) html += `<div class="detail-item"><span class="label">機動</span><span class="value">${part.mobility}</span></div>`;
        if (part.armor) html += `<div class="detail-item"><span class="label">防御</span><span class="value">${part.armor}</span></div>`;
        if (part.stability) html += `<div class="detail-item"><span class="label">安定</span><span class="value">${part.stability}</span></div>`;
        return html;
    }

    updateAllFocus() {
        this.dom.medarotList.querySelectorAll('li').forEach(li => {
            const isFocused = this.uiState.focus === 'MEDAROT_SELECT' && parseInt(li.dataset.index) === this.uiState.selectedMedarotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        this.dom.equippedPartsList.querySelectorAll('li').forEach(li => {
            const isFocused = this.uiState.focus === 'PART_SLOT' && parseInt(li.dataset.index) === this.uiState.selectedPartSlotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        this.dom.partsList.querySelectorAll('li').forEach(li => {
            const isFocused = this.uiState.focus === 'PART_LIST' && parseInt(li.dataset.index) === this.uiState.selectedPartListIndex;
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