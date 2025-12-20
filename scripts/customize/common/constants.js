/**
 * @file カスタマイズシーン固有の定数定義
 */
import { PartType } from '../../common/constants.js';

/**
 * カスタマイズ画面の装備スロットタイプを定義する定数
 */
export const EquipSlotType = {
    ...PartType,
    MEDAL: 'medal'
};