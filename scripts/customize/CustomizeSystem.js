import { GameDataManager } from '../core/GameDataManager.js';
import { InputManager } from '../core/InputManager.js';
import { PartInfo, PartKeyToInfoMap } from '../battle/common/constants.js';

/**
 * カスタマイズ画面のUI制御とロジックをすべて管理するシステム。
 */
export class CustomizeSystem {
    constructor(world) {
        this.world = world;
        this.dataManager = new GameDataManager();
        this.input = new InputManager();

        this.dom = {}; // DOM要素の参照を保持
        this.templates = {}; // テンプレートを保持

        // UIの状態
        this.state = {
            focus: 'MEDAROT_SELECT', // MEDAROT_SELECT | PART_SLOT | PART_LIST
            selectedMedarotIndex: 0,
            selectedPartSlotIndex: 0,
            selectedPartListIndex: 0,
        };

        // ★リファクタリング: ハードコードされた文字列を PartInfo 定数から生成
        this.partSlots = [PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key, PartInfo.LEGS.key];
        this.currentPartListData = [];

        this.init();
    }

    /**
     * システムの初期化。DOMの参照を取得し、初期描画を行う。
     */
    init() {
        this.cacheDOM();
        this.cacheTemplates();
        this.renderAll();
    }

    /**
     * 頻繁にアクセスするDOM要素をキャッシュする。
     */
    cacheDOM() {
        this.dom.container = document.getElementById('customize-container');
        this.dom.medarotList = document.getElementById('medarot-select-list');
        this.dom.equippedMedarotName = document.getElementById('equipped-medarot-name');
        this.dom.equippedPartsList = document.getElementById('equipped-parts-list');
        this.dom.partsListTitle = document.getElementById('parts-list-title');
        this.dom.partsList = document.getElementById('parts-list');
        this.dom.partDetailsContent = document.getElementById('part-details-content');
    }

    /**
     * HTMLテンプレートをキャッシュする。
     */
    cacheTemplates() {
        this.templates.medarotItem = document.getElementById('medarot-list-item-template');
        this.templates.equippedPartItem = document.getElementById('equipped-part-item-template');
        this.templates.partListItem = document.getElementById('part-list-item-template');
    }

    /**
     * 画面全体を現在のデータに基づいて再描画する。
     */
    renderAll() {
        this.renderMedarotList();
        this.renderEquippedParts();
        this.renderPartsList();
        this.renderPartDetails();
        this.updateAllFocus();
    }

    /**
     * 左パネルのメダロット選択リストを描画する。
     */
    renderMedarotList() {
        this.dom.medarotList.innerHTML = '';
        // ★リファクタリング: GameDataManagerの生データを直接参照し、責務を明確化
        const medarots = this.dataManager.gameData.playerMedarots;
        medarots.forEach((medarot, index) => {
            const clone = this.templates.medarotItem.content.cloneNode(true);
            const item = clone.querySelector('li');
            item.dataset.index = index;
            item.querySelector('.medarot-name').textContent = medarot.name;
            this.dom.medarotList.appendChild(clone);
        });
    }

    /**
     * 中央パネルの現在装備しているパーツリストを描画する。
     */
    renderEquippedParts() {
        this.dom.equippedPartsList.innerHTML = '';
        const medarot = this.dataManager.getMedarot(this.state.selectedMedarotIndex);
        if (!medarot) return;

        this.dom.equippedMedarotName.textContent = medarot.name;

        this.partSlots.forEach((slotKey, index) => {
            const part = medarot.parts[slotKey];
            const clone = this.templates.equippedPartItem.content.cloneNode(true);
            const item = clone.querySelector('li');
            item.dataset.index = index;
            item.dataset.slot = slotKey;

            // ★リファクタリング: PartKeyToInfoMap を使用して効率的にパーツ名を取得
            const slotInfo = PartKeyToInfoMap[slotKey];
            item.querySelector('.part-slot-name').textContent = slotInfo ? slotInfo.name : '不明';
            item.querySelector('.part-name').textContent = part.data ? part.data.name : 'なし';
            this.dom.equippedPartsList.appendChild(clone);
        });
    }

    /**
     * 中央パネルの交換可能パーツリストを描画する。
     */
    renderPartsList() {
        // 選択中のスロットに基づいてパーツリストを描画
        const selectedSlot = this.partSlots[this.state.selectedPartSlotIndex];
        // ★リファクタリング: PartKeyToInfoMap を使用して効率的にスロット名を取得
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

    /**
     * 右パネルのパーツ詳細を描画する。
     */
    renderPartDetails() {
        this.dom.partDetailsContent.innerHTML = 'パーツを選択してください';
        let partToShow = null;

        if (this.state.focus === 'PART_SLOT') {
            const medarot = this.dataManager.getMedarot(this.state.selectedMedarotIndex);
            const slotKey = this.partSlots[this.state.selectedPartSlotIndex];
            partToShow = medarot?.parts[slotKey]?.data;
        } else if (this.state.focus === 'PART_LIST') {
            partToShow = this.currentPartListData[this.state.selectedPartListIndex];
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

    /**
     * すべてのUI要素のフォーカス状態を更新する。
     */
    updateAllFocus() {
        // メダロットリスト
        this.dom.medarotList.querySelectorAll('li').forEach(li => {
            const isFocused = this.state.focus === 'MEDAROT_SELECT' && parseInt(li.dataset.index) === this.state.selectedMedarotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // 装備パーツリスト
        this.dom.equippedPartsList.querySelectorAll('li').forEach(li => {
            const isFocused = this.state.focus === 'PART_SLOT' && parseInt(li.dataset.index) === this.state.selectedPartSlotIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });

        // パーツリスト
        this.dom.partsList.querySelectorAll('li').forEach(li => {
            const isFocused = this.state.focus === 'PART_LIST' && parseInt(li.dataset.index) === this.state.selectedPartListIndex;
            li.classList.toggle('focused', isFocused);
            if (isFocused) li.scrollIntoView({ block: 'nearest' });
        });
    }

    /**
     * 毎フレームの更新処理。入力ハンドリングを行う。
     */
    update(deltaTime) {
        this.handleInput();
    }

    /**
     * キーボード入力を処理し、UIの状態を更新する。
     */
    handleInput() {
        let stateChanged = false;

        // Xキー (キャンセル/戻る)
        if (this.input.wasKeyJustPressed('x')) {
            switch (this.state.focus) {
                case 'PART_SLOT':
                    this.state.focus = 'MEDAROT_SELECT';
                    stateChanged = true;
                    break;
                case 'PART_LIST':
                    this.state.focus = 'PART_SLOT';
                    stateChanged = true;
                    break;
                case 'MEDAROT_SELECT':
                    // TODO: マップに戻る前に確認ダイアログを出す
                    this.world.emit('CUSTOMIZE_EXIT_REQUESTED');
                    break;
            }
        }

        // Zキー (決定)
        if (this.input.wasKeyJustPressed('z')) {
            switch (this.state.focus) {
                case 'MEDAROT_SELECT':
                    this.state.focus = 'PART_SLOT';
                    stateChanged = true;
                    break;
                case 'PART_SLOT':
                    this.state.focus = 'PART_LIST';
                    this.state.selectedPartListIndex = 0; // リストの先頭にフォーカス
                    stateChanged = true;
                    break;
                case 'PART_LIST':
                    this.equipPart();
                    this.state.focus = 'PART_SLOT'; // 装備後はスロット選択に戻る
                    stateChanged = true;
                    break;
            }
        }

        // 方向キー
        const verticalMove = this.input.wasKeyJustPressed('ArrowDown') ? 1 : this.input.wasKeyJustPressed('ArrowUp') ? -1 : 0;
        const horizontalMove = this.input.wasKeyJustPressed('ArrowRight') ? 1 : this.input.wasKeyJustPressed('ArrowLeft') ? -1 : 0;

        if (verticalMove !== 0) {
            switch (this.state.focus) {
                case 'MEDAROT_SELECT':
                    const medarotCount = this.dataManager.gameData.playerMedarots.length;
                    this.state.selectedMedarotIndex = (this.state.selectedMedarotIndex + verticalMove + medarotCount) % medarotCount;
                    stateChanged = true;
                    break;
                case 'PART_SLOT':
                    this.state.selectedPartSlotIndex = (this.state.selectedPartSlotIndex + verticalMove + this.partSlots.length) % this.partSlots.length;
                    stateChanged = true;
                    break;
                case 'PART_LIST':
                    if (this.currentPartListData.length > 0) {
                        this.state.selectedPartListIndex = (this.state.selectedPartListIndex + verticalMove + this.currentPartListData.length) % this.currentPartListData.length;
                    }
                    stateChanged = true;
                    break;
            }
        }

        if (horizontalMove !== 0) {
            // 水平移動のロジックは現在PART_SLOTとPART_LISTには不要
        }

        if (stateChanged) {
            this.renderAll();
        }
    }

    /**
     * 選択したパーツをメダロットに装備させる。
     */
    equipPart() {
        const selectedSlot = this.partSlots[this.state.selectedPartSlotIndex];
        const selectedPart = this.currentPartListData[this.state.selectedPartListIndex];
        if (!selectedPart) return;

        this.dataManager.updateMedarotPart(this.state.selectedMedarotIndex, selectedSlot, selectedPart.id);
        this.dataManager.saveGame(); // パーツ交換のたびにセーブ
    }

    /**
     * カスタマイズ画面を非表示にし、クリーンアップを行う。
     */
    destroy() {
        this.dom.container.classList.add('hidden');
    }
}