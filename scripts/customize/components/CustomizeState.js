/**
 * @file カスタマイズ画面のUI状態を管理するシングルトンコンポーネント
 * どのパネルがフォーカスされているか、どの項目が選択されているかといった
 * UIに特化した状態を一元管理します。
 */
export class CustomizeState {
    constructor() {
        /** @type {'MEDAROT_SELECT' | 'PART_SLOT' | 'PART_LIST'} */
        this.focus = 'MEDAROT_SELECT';
        /** @type {number} */
        this.selectedMedarotIndex = 0;
        /** @type {number} */
        this.selectedPartSlotIndex = 0;
        /** @type {number} */
        this.selectedPartListIndex = 0;
    }
}