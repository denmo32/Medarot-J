/**
 * @file カスタマイズ画面のUI状態を管理するシングルトンコンポーネント
 * どのパネルがフォーカスされているか、どの項目が選択されているかといった
 * UIに特化した状態を一元管理します。
 */
export class CustomizeState {
    constructor() {
        /** 
         * フォーカス対象をより詳細に管理
         * - MEDAROT_SELECT: 左パネルの機体選択
         * - EQUIP_PANEL: 中央上の装備パネル（パーツスロットとメダルスロット）
         * - ITEM_LIST: 中央下の選択リスト（パーツまたはメダル）
         * @type {'MEDAROT_SELECT' | 'EQUIP_PANEL' | 'ITEM_LIST'} 
         */
        this.focus = 'MEDAROT_SELECT';
        /** @type {number} */
        this.selectedMedarotIndex = 0;
        /** 
         * 装備パネル内の選択インデックス (0-3: パーツ, 4: メダル)
         * @type {number} 
         */
        this.selectedEquipIndex = 0;
        /** @type {number} */
        this.selectedPartListIndex = 0;
        /** @type {number} */
        this.selectedMedalListIndex = 0;
    }
}