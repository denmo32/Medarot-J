/**
 * @file CustomizeUIManager.js
 * @description カスタマイズシーンのDOM操作を担当するクラス。
 */
import { el } from '../../../engine/utils/DOMUtils.js';
import { PartKeyToInfoMap } from '../../common/constants.js';
import { EquipSlotType } from '../common/constants.js';

export class CustomizeUIManager {
    constructor() {
        this.dom = {
            container: document.getElementById('customize-container'),
            medarotList: document.getElementById('medarot-select-list'),
            equippedMedarotName: document.getElementById('equipped-medarot-name'),
            equippedPartsList: document.getElementById('equipped-parts-list'),
            equippedMedalList: document.getElementById('equipped-medal-list'),
            partsListTitle: document.getElementById('parts-list-title'),
            partsList: document.getElementById('parts-list'),
            partDetailsContent: document.getElementById('part-details-content'),
        };
        
        // 表示順序の定義
        this.equipSlots = [EquipSlotType.MEDAL, EquipSlotType.HEAD, EquipSlotType.RIGHT_ARM, EquipSlotType.LEFT_ARM, EquipSlotType.LEGS];
    }

    show() {
        this.dom.container.classList.remove('hidden');
    }

    hide() {
        this.dom.container.classList.add('hidden');
    }

    renderMedarotList(medarots) {
        this.dom.medarotList.innerHTML = '';
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

    renderEquippedItems(medarot) {
        this.dom.equippedPartsList.innerHTML = '';
        this.dom.equippedMedalList.innerHTML = '';
        
        if (!medarot) {
            this.dom.equippedMedarotName.textContent = '';
            return;
        }

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

    renderSelectionList(title, items) {
        this.dom.partsListTitle.textContent = title;
        this.dom.partsList.innerHTML = '';

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

    renderDetails(item) {
        this.dom.partDetailsContent.innerHTML = '';
        
        if (item) {
            this.dom.partDetailsContent.appendChild(this._createDetailContent(item));
        } else {
            this.dom.partDetailsContent.textContent = '項目を選択してください';
        }
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

    updateFocus(state) {
        const { focus, selectedMedarotIndex, selectedEquipIndex, selectedMedalListIndex, selectedPartListIndex, currentSlotType } = state;

        // メダロットリストのフォーカス
        this._updateListFocus(this.dom.medarotList, focus === 'MEDAROT_SELECT', selectedMedarotIndex);
        
        // 装備パネルのフォーカス
        const allEquipItems = [
            ...this.dom.equippedMedalList.querySelectorAll('li'),
            ...this.dom.equippedPartsList.querySelectorAll('li')
        ];
        allEquipItems.forEach(li => {
            const isFocused = focus === 'EQUIP_PANEL' && parseInt(li.dataset.index) === selectedEquipIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // アイテムリストのフォーカス
        const isMedalList = currentSlotType === EquipSlotType.MEDAL;
        const listIndex = isMedalList ? selectedMedalListIndex : selectedPartListIndex;
        this._updateListFocus(this.dom.partsList, focus === 'ITEM_LIST', listIndex);
    }

    _updateListFocus(listElement, isPanelFocused, selectedIndex) {
        listElement.querySelectorAll('li').forEach(li => {
            const isItemFocused = isPanelFocused && parseInt(li.dataset.index) === selectedIndex;
            li.classList.toggle('focused', isItemFocused);
            if (isItemFocused) li.scrollIntoView({ block: 'nearest' });
        });
    }
}