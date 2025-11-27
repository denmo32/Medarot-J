/**
 * @file カスタマイズ画面のUI状態を管理するシングルトンコンポーネント
 */
export class CustomizeState {
    constructor() {
        /** 
         * @type {'MEDAROT_SELECT' | 'EQUIP_PANEL' | 'ITEM_LIST'} 
         */
        this.focus = 'MEDAROT_SELECT';
        /** @type {number} */
        this.selectedMedarotIndex = 0;
        /** 
         * @type {number} 
         */
        this.selectedEquipIndex = 0;
        /** @type {number} */
        this.selectedPartListIndex = 0;
        /** @type {number} */
        this.selectedMedalListIndex = 0;
    }
}